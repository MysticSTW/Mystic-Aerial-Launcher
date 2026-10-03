import type {
  TaxiServiceAccountData,
  TaxiServiceAccountFileData,
  TaxiServiceAccountFileDataList,
  TaxiServiceAccountServerData,
  TaxiServiceServiceActionConfig,
  TaxiServiceServiceStatusResponse,
} from '../../types/taxi-service'

import { Collection } from '@discordjs/collection'
import { Client } from 'fnbr'
import { appendFile } from 'node:fs/promises'
import { readdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import path from 'node:path'

import workingTaxiMemberMeta from '../../config/fortnite/taxi-member-meta.json'
import ClientPartyMember from 'fnbr/dist/src/structures/party/ClientPartyMember'

/**
 * fnbr sends its whole default member meta (MatchmakingInfo "NotReady",
 * MpLoadout, LoadoutMeta, ...) as the first patch right after joining, from
 * inside its own join code. The leader's game keeps that first view and
 * ignores later deletes, so it waits on the taxi forever. For taxi clients
 * every member patch is rewritten to a working taxi's meta (PennyReverse03)
 * before it is sent, so the first thing the game sees is already right.
 */
const taxiMetaKeep = new Set([
  'Default:FORTStats_j',
  'Default:CampaignCommanderLoadoutRating_d',
  'Default:CampaignBackpackRating_d',
])

function toWorkingTaxiMeta(updated: Record<string, unknown>) {
  const template = workingTaxiMemberMeta as Record<string, string>
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(updated)) {
    if (!key.startsWith('Default:') || taxiMetaKeep.has(key)) {
      result[key] = value
    } else if (key in template) {
      result[key] = template[key]
    }
  }

  // The big first patch after joining: send the whole template with it.
  if (Object.keys(updated).length > 10) {
    Object.assign(result, template, result)
  }

  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memberPrototype = (ClientPartyMember as any).prototype
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalSendPatch = memberPrototype.sendPatch as (updated: any) => Promise<void>

if (!memberPrototype.__mysticTaxiPatched) {
  memberPrototype.__mysticTaxiPatched = true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memberPrototype.sendPatch = function sendPatch(this: any, updated: any) {
    if (this.client?.__mysticTaxi) {
      return originalSendPatch.call(this, toWorkingTaxiMeta(updated ?? {}))
    }

    return originalSendPatch.call(this, updated)
  }
}

import { AutomationStatusType } from '../../config/constants/automation'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { Authentication } from '../core/authentication'
import { LookupManager } from '../core/lookup'
import { MainWindow } from './windows/main'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'

import {
  TaxiServiceNotificationEventFriendAdded,
  TaxiServiceNotificationEventFriendRequestSend,
  TaxiServiceNotificationEventPartyInvite,
  TaxiServiceNotificationEventPartyMemberJoined,
  TaxiServiceNotificationType,
} from '../../state/stw-operations/taxi-service'

import { addFriend, removeFriend } from '../../services/endpoints/friends'

import { getExtendedDateFormat } from '../../lib/dates'
import { parseCustomDisplayName } from '../../lib/utils'

/**
 * Heavy recording used to copy a working taxi (full meta of other members,
 * MatchmakingInfo/Data and a party snapshot every 5s). Off for normal use,
 * turn on if the taxi breaks after a Fortnite update.
 */
const taxiRecording = false

/**
 * Plain text log of what the taxi does, so a stuck matchmaking can be traced:
 * %APPDATA%\mystic-launcher-data\taxi-log.txt
 */
let taxiLogChecked = false

function taxiLog(accountName: string, message: string) {
  const line = `${new Date().toISOString()} [${accountName}] ${message}\n`
  const file = path.join(
    `${process.env.APPDATA}`,
    'mystic-launcher-data',
    'taxi-log.txt',
  )

  // Once per session: start a fresh log when it gets big (the old one is
  // kept as taxi-log.old.txt).
  if (!taxiLogChecked) {
    taxiLogChecked = true

    try {
      if (statSync(file).size > 1_000_000) {
        renameSync(file, file.replace(/\.txt$/, '.old.txt'))
      }
    } catch {
      //
    }
  }

  appendFile(file, line).catch(() => {})
}

/**
 * Fortnite hides Invite/Join for friends whose presence reports an unknown
 * game version, and fnbr sends a placeholder (`00.00`). Look up the live
 * version (cached for an hour) so the taxi reports a compatible build.
 */
let fortniteProductVersion: { value: Promise<string | null>; at: number } | null =
  null

/**
 * The exact version a real Fortnite client reports (seen in a friend's
 * presence). Preferred over the server version, whose CL differs from the
 * game client's.
 */
let observedProductVersion: string | null = null

/**
 * Exact version of the Fortnite installed on this PC, read from the Epic
 * Games Launcher manifest (e.g. `++Fortnite+Release-42.20-CL-58011042`).
 * Invites only appear when the taxi reports the same build as the inviter.
 */
function getInstalledFortniteVersion() {
  try {
    const manifestsDir = path.join(
      process.env.ProgramData ?? 'C:\\ProgramData',
      'Epic',
      'EpicGamesLauncher',
      'Data',
      'Manifests',
    )

    for (const file of readdirSync(manifestsDir)) {
      if (!file.endsWith('.item')) {
        continue
      }

      const manifest = JSON.parse(
        readFileSync(path.join(manifestsDir, file), 'utf8'),
      ) as { AppName?: string; AppVersionString?: string }
      const version = manifest.AppVersionString?.match(
        /^(\+\+Fortnite\+Release-[\d.]+-CL-\d+)/,
      )?.[1]

      if (manifest.AppName === 'Fortnite' && version) {
        return version
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    //
  }

  return null
}

function getFortniteProductVersion() {
  const installedVersion = getInstalledFortniteVersion()

  if (installedVersion) {
    return Promise.resolve(installedVersion)
  }

  if (observedProductVersion) {
    return Promise.resolve(observedProductVersion)
  }

  if (
    !fortniteProductVersion ||
    Date.now() - fortniteProductVersion.at > 60 * 60 * 1000
  ) {
    fortniteProductVersion = {
      at: Date.now(),
      value: fetch(
        'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/version',
      )
        .then((response) => response.json())
        .then((data: { branch?: string; cln?: string }) =>
          data.branch && data.cln
            ? `++Fortnite+${data.branch}-CL-${data.cln}`
            : null,
        )
        .catch(() => {
          fortniteProductVersion = null

          return null
        }),
    }
  }

  return fortniteProductVersion.value
}

export enum AccountPresence {
  Active = 'active',
  DnD = 'dnd',
  Unknown = 'unknown',
}

export enum AccountStatus {
  Offline = 'offline',
  Online = 'online',
}

export enum FORTStatsNumber {
  LOW = 0,
  HIGH = 92765,
}

export enum MatchmakingResult {
  NotStarted = 'NotStarted',
  Success = 'Success',
}

export enum MatchmakingState {
  FindingEmptyServer = 'FindingEmptyServer',
  JoiningExistingSession = 'JoiningExistingSession',
  NotMatchmaking = 'NotMatchmaking',
  TestingEmptyServers = 'TestingEmptyServers',
}

export type PartyMetaSchema = {
  'Default:CampaignInfo_j': {
    CampaignInfo: {
      matchmakingResult: MatchmakingResult
      matchmakingState: MatchmakingState
    }
  }
  'Default:ZoneInstanceId_s'?: {
    /**
     * Main zone Id: Stonewood, Plankerton, Canny Valley, Twine Peaks, etc
     */
    theaterId: string
    /**
     * Mission Alert Id (one-time extra reward)
     */
    theaterMissionAlertId: string
    /**
     * Mission Id
     */
    theaterMissionId: string
    worldId: string
    zoneThemeClass: string
  }
}

type AccountService = {
  accountId: string
  status: AccountPresence
  client: Client
  currentTimeout?: NodeJS.Timeout | null
}

const maxRetries = 3

export class TaxiService {
  private static _accounts: Collection<
    string,
    TaxiServiceAccountServerData
  > = new Collection()
  private static _services: Collection<string, AccountService> =
    new Collection()
  private static _retryCounters: Collection<string, number> =
    new Collection()
  private static _reJoinTo: Collection<string, string> = new Collection()

  static async load() {
    const { taxiService } = await DataDirectory.getTaxiServiceFile()
    const accounts = AccountsManager.getAccounts()

    Object.values(taxiService).forEach((data) => {
      if (!accounts.has(data.accountId)) {
        return
      }

      // load() runs every time the Taxi Service page asks for its data (and
      // after window reloads). Only start a taxi that isn't running yet,
      // otherwise a second client for the same account fights the first one
      // over every invite.
      if (TaxiService._services.has(data.accountId)) {
        return
      }

      TaxiService._accounts.set(data.accountId, {
        ...data,
        status: AutomationStatusType.LOADING,
      })
      TaxiService.start(data)
    })

    MainWindow.send(
      ElectronAPIEventKeys.TaxiServiceServiceResponseData,
      taxiService,
      false,
    )
  }

  static async sendRequests(
    origin: Array<string>,
    destination: Array<string>,
  ) {
    origin.map(async (accountId) => {
      const account = AccountsManager.getAccountById(accountId)

      if (!account) {
        return
      }

      const response = await Promise.all(
        destination.map(async (displayName) => {
          const result = await LookupManager.searchUserByDisplayName({
            account,
            displayName,
          })

          if (!result.success) {
            return {
              displayName,
              accountId: displayName,
              error: result.errorCode,
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]
          }

          const accessToken =
            await Authentication.verifyAccessToken(account)

          if (!accessToken) {
            return {
              displayName,
              accountId: displayName,
              error: 'invalid_access_token',
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]
          }

          try {
            await addFriend({
              accessToken,
              accountId,
              friendId: result.data.id,
            })

            return {
              accountId: result.data.id,
              displayName: result.data.displayName,
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            const response =
              (error?.response?.data as Record<string, number | string>) ??
              {}

            return {
              accountId: result.data.id,
              displayName: result.data.displayName,
              error:
                `${response.errorCode}`?.split('.')?.at(-1) ?? 'UNKNOWN',
            } as TaxiServiceNotificationEventFriendRequestSend['accounts'][number]
          }
        }),
      )

      const data = {
        id: crypto.randomUUID(),
        accounts: response,
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        type: TaxiServiceNotificationType.FriendRequestSend,
        withErrors: response.some((item) => item.error !== undefined),
      } as TaxiServiceNotificationEventFriendRequestSend

      MainWindow.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )
    })
  }

  static async addAccount(accountId: string) {
    const result = await DataDirectory.getTaxiServiceFile()
    const data = {
      accountId,
      actions: {
        high: true,
        denyFriendsRequests: true,
        activeStatus: '',
        busyStatus: '',
      },
    }

    await DataDirectory.updateTaxiServiceFile({
      ...result.taxiService,
      [accountId]: data,
    })
    TaxiService._accounts.set(data.accountId, {
      ...data,
      status: AutomationStatusType.LOADING,
    })
    TaxiService.start(data)
  }

  static async removeAccount(accountId: string) {
    const currentTimeout =
      TaxiService.getServiceByAccountId(accountId)?.currentTimeout

    if (currentTimeout !== null && currentTimeout !== undefined) {
      TaxiService.getServiceByAccountId(accountId)?.client.clearTimeout(
        currentTimeout,
      )
    }

    TaxiService.updateAccountData(accountId, {
      status: AutomationStatusType.LOADING,
    })
    TaxiService.getServiceByAccountId(
      accountId,
    )?.client.removeAllListeners()
    TaxiService.getServiceByAccountId(accountId)?.client.xmpp.disconnect()
    TaxiService.getServiceByAccountId(accountId)?.client.logout()

    await TaxiService.refreshData(accountId, true)
  }

  static async updateAction(
    accountId: string,
    config: TaxiServiceServiceActionConfig,
  ) {
    TaxiService.updateAccountData(accountId, {
      actions: {
        [config.type]: config.value,
      },
    })

    const current = TaxiService._accounts.get(accountId)

    if (!current) {
      return
    }

    const result = await DataDirectory.getTaxiServiceFile()
    const data = {
      accountId,
      actions: {
        ...current.actions,
        [config.type]: config.value,
      },
    }

    await DataDirectory.updateTaxiServiceFile({
      ...result.taxiService,
      [accountId]: data,
    })
  }

  static start(data: TaxiServiceAccountFileData) {
    // Never run two clients for the same account: shut down the old one.
    const existing = TaxiService._services.get(data.accountId)

    if (existing) {
      if (
        existing.currentTimeout !== null &&
        existing.currentTimeout !== undefined
      ) {
        existing.client.clearTimeout(existing.currentTimeout)
      }

      existing.client.removeAllListeners()
      existing.client.xmpp.disconnect()
      existing.client.logout().catch(() => {})
      TaxiService._services.delete(data.accountId)
    }

    const setNewStatus = (status: AutomationStatusType) => {
      TaxiService.updateAccountData(data.accountId, {
        status,
      })
      MainWindow.send(
        ElectronAPIEventKeys.TaxiServiceServiceStartNotification,
        {
          accountId: data.accountId,
          status,
        } as TaxiServiceServiceStatusResponse,
      )
    }

    setNewStatus(AutomationStatusType.LOADING)

    const defaultStatuses = {
      active: () => {
        const info = TaxiService._accounts.get(data.accountId)

        if (!info) {
          return 'Free'
        }

        return info.actions.activeStatus.trim().length > 0
          ? info.actions.activeStatus.trim()
          : 'Free'
      },
      busy: () => {
        const info = TaxiService._accounts.get(data.accountId)

        if (!info) {
          return 'Busy'
        }

        return info.actions.busyStatus.trim().length > 0
          ? info.actions.busyStatus.trim()
          : 'Busy'
      },
    }
    const account = AccountsManager.getAccountById(data.accountId)!

    /**
     * fnbr receives the party XMPP notifications but doesn't turn them into
     * location/matchmaking events any more, so the raw messages are read here
     * (set further down, once leaveForMatchmaking exists).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onRawPartyNotification: ((body: any) => void) | null = null

    const accountService: AccountService = {
      accountId: account.accountId,
      status: AccountPresence.Unknown,
      currentTimeout: null as undefined | NodeJS.Timeout | null,
      client: new Client({
        auth: {
          deviceAuth: {
            accountId: account.accountId,
            deviceId: account.deviceId,
            secret: account.secret,
          },
          authClient: 'fortniteAndroidGameClient',
          createLauncherSession: false,
          killOtherTokens: false,
        },
        partyConfig: {
          chatEnabled: false,
          discoverability: 'INVITED_ONLY',
          joinability: 'INVITE_AND_FORMER',
          joinConfirmation: true,
          maxSize: 4,
          privacy: {
            acceptingMembers: true,
            invitePermission: 'AnyMember',
            inviteRestriction: 'AnyMember',
            onlyLeaderFriendsCanJoin: false,
            partyType: 'Private',
            presencePermission: 'Anyone',
          },
        },
        defaultOnlineType: 'away',
        defaultStatus: defaultStatuses.active(),
        restRetryLimit: 3,
        // fnbr's XMPP retry check is inverted (`retries >= max` reconnects,
        // otherwise it logs out), so 0 means "always reconnect after 5s"
        // instead of logging the taxi out on the first dropped connection.
        xmppMaxConnectionRetries: 0,
        // Party traffic only, for taxi-log.txt (see taxiLog).
        xmppDebug: (message: string) => {
          if (!/party\.notification/i.test(message)) {
            return
          }

          const raw = message.match(/<body>([\s\S]*?)<\/body>/)?.[1]

          if (!raw) {
            return
          }

          try {
            const body = JSON.parse(
              raw
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&apos;/g, "'")
                .replace(/&amp;/g, '&'),
            )

            onRawPartyNotification?.(body)
          } catch (_error) {
            //
          }
        },
        stompDebug: (message: string) => {
          if (/party|error|disconnect/i.test(message)) {
            taxiLog(account.displayName, `STOMP ${message.slice(0, 500)}`)
          }
        },
      }),
    }

    // Marks this fnbr client as a taxi so its member patches are rewritten
    // (see toWorkingTaxiMeta at the top).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(accountService.client as any).__mysticTaxi = true

    const clearCurrentTimeout = () => {
      if (
        accountService.currentTimeout !== null &&
        accountService.currentTimeout !== undefined
      ) {
        accountService.client.clearTimeout(accountService.currentTimeout)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reAuth = (error: any) => {
      const restartErrors = [
        'disconnect',
        'invalid_refresh_token',
        'party_not_found',
      ].some((code) => error?.code?.toLowerCase().includes(code))

      if (restartErrors) {
        if (error?.code === 'disconnect') {
          if (
            (TaxiService._retryCounters.get(account.accountId) ?? 0) <
            maxRetries
          ) {
            TaxiService.reload([account.accountId])
          } else {
            TaxiService._retryCounters.delete(account.accountId)
          }
        } else {
          TaxiService.reload([account.accountId])
        }
      }
    }
    const disconnect = () => {
      setNewStatus(AutomationStatusType.DISCONNECTED)

      if (!TaxiService._retryCounters.has(account.accountId)) {
        TaxiService._retryCounters.set(account.accountId, 0)
      }

      accountService.status = AccountPresence.Unknown
      TaxiService._retryCounters.set(
        account.accountId,
        (TaxiService._retryCounters.get(account.accountId) ?? 0) + 1,
      )

      reAuth({ code: 'disconnect' })
    }

    const initTimeout = setTimeout(() => {
      setNewStatus(AutomationStatusType.ERROR)
      accountService.status = AccountPresence.Unknown
      disconnect()
    }, 10_000) // 10 seconds

    accountService.client.once('ready', () => {
      setNewStatus(AutomationStatusType.LISTENING)
      accountService.status = AccountPresence.Active
      clearTimeout(initTimeout)
      // Connected again: the retry limit is for back-to-back failures, not
      // for every disconnect in a long session.
      TaxiService._retryCounters.delete(account.accountId)

      // When Fortnite isn't installed on this PC, learn the exact game version
      // from a friend's presence and republish (see getFortniteProductVersion).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stompConnection = (accountService.client.stomp as any)?.connection
        stompConnection?.on('message', (raw: Buffer) => {
          const text = raw.toString()

          if (!text.includes('presence.v1.UPDATE')) {
            return
          }

          const version = text.match(
            /"EOS_ProductVersion":"(\+\+Fortnite\+Release-[^"]+)"/,
          )?.[1]

          if (version && version !== observedProductVersion) {
            observedProductVersion = version
            accountService.client.setStatus().catch(() => {})
          }
        })

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        //
      }

      const denyFriendsRequests =
        TaxiService._accounts.get(accountService.accountId)?.actions
          .denyFriendsRequests ?? true

      if (denyFriendsRequests) {
        const pendingList =
          accountService.client.friend.pendingList.filter(
            (item) => item.direction === 'INCOMING',
          )

        Authentication.verifyAccessToken(account).then((accessToken) => {
          if (!accessToken) {
            return
          }

          pendingList.forEach((pending) => {
            removeFriend({
              accessToken,
              accountId: account.accountId,
              friendId: pending.id,
            })
          })
        })
      }

      if (TaxiService._reJoinTo.has(account.accountId)) {
        accountService.client.friend
          .resolve(TaxiService._reJoinTo.get(account.accountId)!)
          ?.sendJoinRequest()
          .catch(() => {})
        TaxiService._reJoinTo.delete(account.accountId)
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountService.client.on('xmpp:message:error', (error: any) => {
      reAuth(error)
    })
    accountService.client.on('disconnected', () => {
      disconnect()
    })
    // fnbr 5 removed `party:member:disconnected`; EOS now reports this as expired.
    accountService.client.on('party:member:expired', (member) => {
      if (member.id === accountService.accountId) {
        disconnect()
      }
    })
    accountService.client.on('party:member:kicked', (member) => {
      if (member.id === accountService.accountId) {
        taxiLog(account.displayName, 'kicked from party')
        clearCurrentTimeout()
        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')
      }
    })
    accountService.client.on('party:member:left', (member) => {
      taxiLog(
        account.displayName,
        member.id === accountService.accountId
          ? 'taxi left party'
          : `member ${member.displayName ?? member.id} left party`,
      )

      if (
        member.id === accountService.accountId ||
        (member.party.members.size === 1 &&
          member.party.members.first()?.id === accountService.accountId)
      ) {
        clearCurrentTimeout()
        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')
      }
    })

    accountService.client.on('friend:request', (incoming) => {
      const denyFriendsRequests =
        TaxiService._accounts.get(accountService.accountId)?.actions
          .denyFriendsRequests ?? true

      Authentication.verifyAccessToken(account).then((accessToken) => {
        if (!accessToken) {
          return
        }

        const data = {
          accessToken,
          accountId: accountService.accountId,
          friendId: incoming.id,
        }

        if (denyFriendsRequests) {
          removeFriend(data)
        } else {
          addFriend(data)
        }
      })
    })

    accountService.client.on('party:member:joined', async (member) => {
      try {
        const partyMetaSchema: Record<string, string> =
          member.party.meta.schema
        const defaultCampaignInfo: PartyMetaSchema['Default:CampaignInfo_j'] =
          JSON.parse(partyMetaSchema['Default:CampaignInfo_j'])
        const { matchmakingState } = defaultCampaignInfo.CampaignInfo

        if (member.id === accountService.accountId) {
          readiedUp = false
          lastPartyState = undefined
          taxiLog(
            account.displayName,
            `joined party (${member.party.members.size} members, party matchmakingState=${matchmakingState})`,
          )
        }

        // CampaignInfo matchmakingState can be stale (e.g. "JoinSuccess" left
        // over after the game crashed mid-matchmaking), which made the taxi
        // leave every new invite. Only leave when the party's own state says
        // it is really matchmaking.
        const partyState = `${partyMetaSchema['Default:PartyState_s'] ?? ''}`
        const reallyMatchmaking = partyState
          ? ['Matchmaking', 'PostMatchmaking'].includes(partyState)
          : matchmakingState !== MatchmakingState.NotMatchmaking

        if (reallyMatchmaking && member.id === accountService.accountId) {
          taxiLog(account.displayName, 'party already matchmaking -> leaving')
          member.client.leaveParty().catch(() => {})
          clearCurrentTimeout()

          // Back to Active, DnD here made the taxi decline every later invite.
          accountService.status = AccountPresence.Active
          member.client.setStatus(defaultStatuses.active(), 'away')

          return
        }
      } catch (error) {
        //
      }

      const filteredMembersId = member.party.members.filter(({ id }) =>
        TaxiService._accounts.has(id),
      )

      if (filteredMembersId.size > 1) {
        /**
         * Only one client at a time can be on the team
         */
        const randomMember = filteredMembersId.random()
        const removeThisMembers = filteredMembersId
          .filter(({ id }) => randomMember?.id !== id)
          .map((item) => item.id)

        await Promise.allSettled(
          removeThisMembers.map(async (item) => {
            const currentClient = TaxiService._services.get(item)

            if (currentClient) {
              try {
                await currentClient.client.party?.leave()
              } catch (error) {
                //
              }

              clearCurrentTimeout()

              currentClient.status = AccountPresence.Active
              currentClient.client.setStatus(
                defaultStatuses.active(),
                'away',
              )
            }
          }),
        )

        return
      }

      let members = member.party.members
        .map((item) => ({
          accountId: item.id,
          displayName: item.displayName,
          isLeader: item.isLeader,
          isSender: false,
        }))
        .filter((item) => item.accountId !== account.accountId)

      if (
        members.length === 0 ||
        (members.length === 1 &&
          members[0]?.accountId === account.accountId)
      ) {
        return
      }

      members = await Promise.all(
        members.map(async (item) => {
          if (typeof item.displayName !== 'string') {
            const result = await LookupManager.searchUserByDisplayName({
              account,
              displayName: item.accountId,
            })

            if (result.success) {
              return {
                ...item,
                displayName: result.data.displayName ?? item.accountId,
              }
            }
          }

          return {
            ...item,
            displayName: item.displayName ?? item.accountId,
          }
        }),
      )

      const data = {
        members,
        id: crypto.randomUUID(),
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        type: TaxiServiceNotificationType.PartyMemberJoined,
      } as TaxiServiceNotificationEventPartyMemberJoined

      MainWindow.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )
    })

    accountService.client.on('party:invite', async (invitation) => {
      const data = {
        id: crypto.randomUUID(),
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        friend: {
          accountId: invitation.sender.id,
          displayName: invitation.sender.displayName,
        },
        type: TaxiServiceNotificationType.PartyInvite,
      } as TaxiServiceNotificationEventPartyInvite

      MainWindow.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )

      // A party that broke up in some orders (leader leaves first, then the
      // others) left the taxi flagged busy until its timer ran out, so new
      // invites were declined. Alone in its own party means it is free.
      if (
        accountService.status === AccountPresence.DnD &&
        (invitation.client.party?.members.size ?? 1) <= 1
      ) {
        clearCurrentTimeout()
        accountService.status = AccountPresence.Active
      }

      /**
       * Client can not join if presence is DnD
       */
      const isDnD = accountService.status === AccountPresence.DnD
      /**
       * Client can not join to a team when total maximum members is full
       */
      const maxMembers = (invitation.party?.members.size ?? 0) >= 4
      /**
       * If client is in a team, decline invitation
       */
      const currentMembers =
        (invitation.client.party?.members.size ?? 1) > 1

      taxiLog(
        account.displayName,
        `invite from ${invitation.sender.displayName ?? invitation.sender.id}`,
      )

      if (isDnD || maxMembers || currentMembers) {
        taxiLog(
          account.displayName,
          `declined (${isDnD ? 'busy' : maxMembers ? 'party full' : 'already in a party'})`,
        )
        invitation.decline().catch(() => {})

        return
      }

      /**
       * Client can join if other client still not joined yet
       */
      const accountsId = TaxiService._accounts.map(
        ({ accountId }) => accountId,
      )
      const filteredMembersId =
        invitation.party?.members
          .filter(({ id }) => accountsId.includes(id))
          .map(({ id }) => id) ?? []
      const otherClientHasPreviouslyJoined = filteredMembersId.length > 0

      if (otherClientHasPreviouslyJoined) {
        taxiLog(account.displayName, 'declined (another taxi is in that party)')
        invitation.decline().catch(() => {})

        return
      }

      try {
        /**
         * Client can not join if matchmaking is changing
         */
        // Fortnite now reports a session ID even in the lobby/homebase, so
        // only decline when the inviter is actually in a match.
        const { isPlaying, isInUnjoinableMatch } =
          invitation.sender.presence ?? {}

        if (isPlaying || isInUnjoinableMatch) {
          taxiLog(account.displayName, 'declined (inviter is in a match)')
          invitation.decline().catch(() => {})

          return
        }
      } catch (error) {
        //
      }

      try {
        accountService.status = AccountPresence.DnD

        await invitation.accept()

        accountService.client.setStatus(defaultStatuses.busy(), 'away')

        await new Promise((resolve) => {
          setTimeout(resolve, 1000)
        })

        await TaxiService.updatePatch(accountService)

        // Not sitting out: a sitting-out member no longer counts for the
        // party, so missions locked (tested in 2.2.1).
        await TaxiService.removeMatchmakingMeta(accountService)

        taxiLog(
          account.displayName,
          `accepted, stats patch sent (${
            TaxiService._accounts.get(accountService.accountId)?.actions.high
              ? 'high'
              : 'low'
          })`,
        )

        // Sent again for slow connections (same as BluGlo).
        setTimeout(() => {
          TaxiService.updatePatch(accountService).catch(() => {})
        }, 4000)

        // Log what the taxi actually has, to confirm MatchmakingInfo is gone.
        setTimeout(() => {
          const schema = (accountService.client.party?.me?.meta.schema ??
            {}) as Record<string, unknown>

          taxiLog(
            account.displayName,
            `taxi meta has MatchmakingInfo: ${'Default:MatchmakingInfo_j' in schema}`,
          )
        }, 6000)

        accountService.currentTimeout = accountService.client.setTimeout(
          () => {
            try {
              taxiLog(account.displayName, '2 minute timeout -> leaving')
              accountService.client.leaveParty().catch(() => {})

              accountService.currentTimeout = null

              accountService.status = AccountPresence.Active
              accountService.client.setStatus(
                defaultStatuses.active(),
                'away',
              )
            } catch (_error) {
              //
            }
          },
          1000 * 60 * 2,
        ) // 2 minutes

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        taxiLog(
          account.displayName,
          `accept failed: ${error?.code ?? error?.message ?? error}`,
        )
        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')

        TaxiService._reJoinTo.set(account.accountId, invitation.sender.id)
        reAuth(error)
      }
    })

    /**
     * Leave as soon as the party starts matchmaking, otherwise the taxi stays
     * in the party and the others can't load into the mission.
     */
    let leavingForMatchmaking = false
    const leaveForMatchmaking = (reason: string) => {
      if (leavingForMatchmaking || !accountService.client.party) {
        return
      }

      leavingForMatchmaking = true
      taxiLog(account.displayName, `matchmaking detected (${reason}) -> leaving`)

      accountService.client.setTimeout(() => {
        accountService.client.leaveParty().catch(() => {})
        clearCurrentTimeout()

        accountService.status = AccountPresence.Active
        accountService.client.setStatus(defaultStatuses.active(), 'away')

        leavingForMatchmaking = false
        readiedUp = false
      }, 500)
    }

    accountService.client.on(
      'party:member:matchstate:updated',
      async (member, value, previousValue) => {
        const previousLocation = `${previousValue?.location}`
        const currentLocation = `${value?.location}`

        taxiLog(
          account.displayName,
          `${member.displayName ?? member.id} location ${previousLocation} -> ${currentLocation}`,
        )

        // STW now goes PreLobby -> ConnectingToLobby when matchmaking starts
        // (the old Lobby -> JoiningGame is kept in case it comes back).
        if (
          (previousLocation === 'PreLobby' &&
            currentLocation === 'ConnectingToLobby') ||
          (previousLocation === 'Lobby' && currentLocation === 'JoiningGame')
        ) {
          leaveForMatchmaking(`${previousLocation} -> ${currentLocation}`)
        }
      },
    )

    const parseMeta = (value: unknown) => {
      if (typeof value !== 'string') {
        return value
      }

      try {
        return JSON.parse(value)
      } catch (_error) {
        return value
      }
    }

    let readiedUp = false
    let lastPartyState: string | undefined

    /**
     * Recording: every 5s while in a party, log how each member is connected
     * (classic party-service connection vs the EOS party) and their ready
     * related meta. Used to copy how other taxis (PennyReverse) join.
     */
    let snapshotTimer: NodeJS.Timeout | null = null
    const snapshotParty = async () => {
      const party = accountService.client.party

      if (!party || party.members.size < 2) {
        return
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const http = accountService.client.http as any
        const classic = await http.epicgamesRequest(
          {
            method: 'GET',
            url: `https://party-service-prod.ol.epicgames.com/party/api/v1/Fortnite/user/${accountService.accountId}`,
          },
          'fortnite',
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = (classic?.current?.[0] ?? {}) as any

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const members = (current.members ?? []).map((member: any) => {
          const meta = member.meta ?? {}
          const pick = (key: string) => {
            const value = meta[key]

            return typeof value === 'string' ? value.slice(0, 400) : value
          }

          return {
            id: member.account_id,
            dn: meta['urn:epic:member:dn_s'],
            role: member.role,
            joined: member.joined_at,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connections: (member.connections ?? []).map((connection: any) => ({
              id: connection.id,
              meta: connection.meta,
              yield: connection.yield_leadership,
            })),
            keys: Object.keys(meta).length,
            hasMatchmakingInfo: 'Default:MatchmakingInfo_j' in meta,
            LobbyState: pick('Default:LobbyState_j'),
            MatchmakingInfoReady: (() => {
              try {
                return JSON.parse(meta['Default:MatchmakingInfo_j'])
                  ?.MatchmakingInfo?.readyStatus
              } catch {
                return undefined
              }
            })(),
            PackedState: pick('Default:PackedState_j'),
            FORTStats: pick('Default:FORTStats_j'),
            JoinMethod: meta['Default:JoinMethod_s'],
          }
        })

        taxiLog(
          account.displayName,
          `SNAPSHOT classic party ${current.id} members=${JSON.stringify(members).slice(0, 12000)}`,
        )

        // Who is in the EOS party (fnbr's side).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eosId = (party as any).eosId

        if (eosId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eos = await (accountService.client as any).eosParty
            .getParty(eosId)
            .catch(() => null)

          taxiLog(
            account.displayName,
            `SNAPSHOT eos party ${eosId} members=${JSON.stringify(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (eos?.members ?? []).map((member: any) => ({
                id: member.account_id ?? member.id ?? member.product_user_id,
                connections: member.connections,
              })),
            ).slice(0, 4000)}`,
          )
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        taxiLog(
          account.displayName,
          `SNAPSHOT failed: ${error?.code ?? error?.message ?? error}`,
        )
      }
    }

    // Raw party messages from Epic (see onRawPartyNotification above).
    onRawPartyNotification = (body) => {
      const type = `${body?.type ?? ''}`.split('.').pop()

      // Keep the recording running while the taxi is in someone's party.
      if (
        taxiRecording &&
        !snapshotTimer &&
        (accountService.client.party?.members.size ?? 0) > 1
      ) {
        snapshotParty()
        snapshotTimer = setInterval(() => {
          if ((accountService.client.party?.members.size ?? 0) > 1) {
            snapshotParty()
          } else if (snapshotTimer) {
            clearInterval(snapshotTimer)
            snapshotTimer = null
          }
        }, 5000)
      }

      if (type === 'MEMBER_LEFT' || type === 'MEMBER_KICKED' || type === 'MEMBER_EXPIRED') {
        taxiLog(
          account.displayName,
          `${type} ${body.account_id === accountService.accountId ? 'taxi' : `${body.account_dn ?? body.account_id}`}`,
        )
      }

      if (type === 'MEMBER_STATE_UPDATED' || type === 'MEMBER_JOINED') {
        const updated: Record<string, unknown> =
          body.member_state_updated ?? {}
        const who =
          body.account_id === accountService.accountId
            ? 'taxi'
            : `${body.account_dn ?? body.account_id}`
        const location = parseMeta(updated['Default:PackedState_j'])
          ?.PackedState?.location

        // Recording other members in full (to copy other taxis, e.g.
        // PennyReverse). The party owner is skipped, only extra members.
        if (
          taxiRecording &&
          body.account_id !== accountService.accountId &&
          body.account_id !== accountService.client.party?.leader?.id
        ) {
          taxiLog(
            account.displayName,
            `FULL ${type} ${who}: ${JSON.stringify(updated).slice(0, 12000)}`,
          )
        }
        const mmInfo = parseMeta(updated['Default:MatchmakingInfo_j'])
          ?.MatchmakingInfo
        const keys = Object.keys(updated)
          .map((key) => key.replace(/^Default:/, ''))
          .join(',')

        taxiLog(
          account.displayName,
          `${type} ${who}: ${keys || '-'}${location ? ` location=${location}` : ''}${
            mmInfo
              ? ` startedMM=${mmInfo.bHasOwnerStartedMM} ready=${mmInfo.readyStatus}`
              : ''
          }`,
        )

        if (body.account_id === accountService.accountId) {
          return
        }

        // STW waits for every member to be Ready before matchmaking, so the
        // taxi readies up with the others, stays while the party searches
        // (it can take a while) and leaves once a server is found.
        if (taxiRecording && mmInfo) {
          taxiLog(
            account.displayName,
            `${who} MatchmakingInfo ${JSON.stringify(mmInfo).slice(0, 3000)}`,
          )
        }

        // The barrier data comes as MatchmakingData1_j or MatchmakingData2_j.
        for (const [key, value] of Object.entries(updated)) {
          if (!/^Default:MatchmakingData\d+_j$/.test(key)) {
            continue
          }

          if (taxiRecording) {
            taxiLog(account.displayName, `${who} ${key} ${`${value}`.slice(0, 3000)}`)
          }

          const data = parseMeta(value)
          const groupData = data?.[key.replace(/^Default:|_j$/g, '')]
            ?.groupMemberData

          // A server was found ("Attempting to join"): leave now, same as
          // the other taxi does.
          if (groupData?.worldSessionId) {
            leaveForMatchmaking(`${who} got server ${groupData.worldSessionId}`)
          }
        }

        // The taxi sits out, so it no longer leaves when the party readies
        // up. The 2 minute invite timer is swapped for 5 minutes so a slow
        // matchmaking isn't cut off.
        if (mmInfo?.readyStatus === 'Ready' && !readiedUp) {
          readiedUp = true
          clearCurrentTimeout()
          accountService.currentTimeout = accountService.client.setTimeout(
            () => leaveForMatchmaking('5 minutes after ready, giving up'),
            1000 * 60 * 5,
          )
        } else if (mmInfo?.readyStatus === 'NotReady' && readiedUp) {
          readiedUp = false
        }

        if (
          location &&
          // "Lobby" is what Spitfire Launcher's taxi leaves on ("Attempting
          // to join").
          ['Lobby', 'ConnectingToLobby', 'JoiningGame', 'InGame'].includes(
            location,
          )
        ) {
          leaveForMatchmaking(`${who} location ${location}`)
        }

        return
      }

      if (type === 'PARTY_UPDATED') {
        const updated: Record<string, unknown> =
          body.party_state_updated ?? {}
        const state = parseMeta(updated['Default:CampaignInfo_j'])
          ?.CampaignInfo?.matchmakingState
        const partyState = updated['Default:PartyState_s']
        const keys = Object.keys(updated)
          .map((key) => key.replace(/^Default:/, ''))
          .join(',')

        taxiLog(
          account.displayName,
          `PARTY_UPDATED: ${keys || '-'}${state ? ` matchmakingState=${state}` : ''}${
            partyState ? ` PartyState=${partyState}` : ''
          }`,
        )

        // Still searching is FindingEmptyServer/TestingEmptyServers, only
        // leave once it is joining a server.
        if (state === MatchmakingState.JoiningExistingSession) {
          leaveForMatchmaking(`party state ${state}`)
        }

        // Matchmaking finished and the party is moving on to a server (not
        // back to TheaterView, which means cancelled/failed).
        if (
          typeof partyState === 'string' &&
          lastPartyState === 'Matchmaking' &&
          partyState !== 'Matchmaking' &&
          // Back to the map screens means cancelled/failed, stay.
          partyState !== 'TheaterView' &&
          partyState !== 'WorldView'
        ) {
          leaveForMatchmaking(`PartyState ${lastPartyState} -> ${partyState}`)
        }

        if (typeof partyState === 'string') {
          lastPartyState = partyState
        }
      }
    }

    // Backup: the party's own STW matchmaking state.
    let lastPartyMatchmakingState: string | undefined
    accountService.client.on('party:updated', (party) => {
      try {
        const schema: Record<string, string> = party.meta.schema
        const campaignInfo: PartyMetaSchema['Default:CampaignInfo_j'] =
          JSON.parse(schema['Default:CampaignInfo_j'])

        const state = campaignInfo.CampaignInfo.matchmakingState

        if (state !== lastPartyMatchmakingState) {
          taxiLog(account.displayName, `party matchmakingState=${state}`)
          lastPartyMatchmakingState = state
        }

        if (state === MatchmakingState.JoiningExistingSession) {
          leaveForMatchmaking(`party state ${state}`)
        }
      } catch (_error) {
        //
      }
    })

    accountService.client.on('friend:added', (friend) => {
      const data = {
        id: crypto.randomUUID(),
        createdAt: getExtendedDateFormat(),
        me: {
          accountId: account.accountId,
          displayName: parseCustomDisplayName(account),
        },
        friend: {
          accountId: friend.id,
          displayName: friend.displayName,
        },
        type: TaxiServiceNotificationType.FriendAdded,
      } as TaxiServiceNotificationEventFriendAdded

      MainWindow.send(
        ElectronAPIEventKeys.TaxiServiceServiceNotifications,
        data,
      )
    })

    // Report the live game version and Save the World in every presence update
    // so Fortnite shows the taxi as invitable (see getFortniteProductVersion).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stomp = accountService.client.stomp as any
    const originalPatchPresence = stomp.patchPresence.bind(stomp)
    stomp.patchPresence = async (
      activity: string,
      props: Record<string, string>,
      onlineType?: string,
    ) => {
      const productVersion = await getFortniteProductVersion()
      const patchedProps = {
        ...props,
        ...(productVersion ? { EOS_ProductVersion: productVersion } : {}),
        ...(props.FortSubGame
          ? { FortSubGame: 'i0', IslandCode: 'scampaign' }
          : {}),
      }

      // Fortnite may not offer invites to friends shown as "away".
      const reportedOnlineType = onlineType === 'away' ? 'online' : onlineType

      return originalPatchPresence(activity, patchedProps, reportedOnlineType)
    }

    accountService.client.login()

    TaxiService._services.set(accountService.accountId, accountService)
  }

  static async reload(ids: Array<string>) {
    ids.forEach(async (accountId) => {
      const account = TaxiService.getAccountById(accountId)
      const current = TaxiService.getServiceByAccountId(accountId)

      if (!current || !account) {
        return
      }

      const setNewStatus = (status: AutomationStatusType) => {
        TaxiService.updateAccountData(current.accountId, {
          status,
        })
        MainWindow.send(
          ElectronAPIEventKeys.TaxiServiceServiceStartNotification,
          {
            accountId: current.accountId,
            status,
          } as TaxiServiceServiceStatusResponse,
        )
      }

      setNewStatus(AutomationStatusType.LOADING)

      if (
        current.currentTimeout !== null &&
        current.currentTimeout !== undefined
      ) {
        current.client.clearTimeout(current.currentTimeout)
      }

      current.client.removeAllListeners()
      current.client.xmpp.disconnect()
      current.client.logout()

      TaxiService._accounts.delete(accountId)
      TaxiService._services.delete(accountId)

      await new Promise((resolve) => {
        setTimeout(resolve, 200)
      })

      const result = await DataDirectory.getTaxiServiceFile()
      const data = {
        accountId,
        actions: {
          high: account.actions.high,
          denyFriendsRequests: account.actions.denyFriendsRequests,
          activeStatus: account.actions.activeStatus,
          busyStatus: account.actions.busyStatus,
        },
      }

      await DataDirectory.updateTaxiServiceFile({
        ...result.taxiService,
        [accountId]: data,
      })
      TaxiService._accounts.set(data.accountId, {
        ...data,
        status: AutomationStatusType.LOADING,
      })
      TaxiService.start(data)
    })
  }

  static getAccountById(
    accountId: string,
  ): TaxiServiceAccountServerData | undefined {
    return TaxiService._accounts.get(accountId)
  }

  static getServices() {
    return TaxiService._services.clone()
  }

  static getServiceByAccountId(accountId: string) {
    return TaxiService._services.find(
      (accountService) => accountService.accountId === accountId,
    )
  }

  /**
   * fnbr joins with its default MatchmakingInfo (NotReady, EU/BR island), so
   * the leader's game treats the taxi as a real player it has to wait for
   * ("waiting" / error #7). Working taxis (Spitfire Launcher) join without
   * any matchmaking meta, so it is deleted from the taxi's member meta.
   */
  private static async removeMatchmakingMeta(
    accountService: AccountService,
    attempt = 0,
  ): Promise<void> {
    const me = accountService.client.party?.me

    if (!me) {
      return
    }

    // The taxi's meta becomes an exact copy of a working taxi's
    // (PennyReverse03, recorded in 2.2.4): every key it has is set to its
    // value and every other key fnbr added is deleted. Our own power level
    // (FORTStats and, for high, the ratings) is kept on top.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = me as any
    const keep = new Set([
      'Default:FORTStats_j',
      'Default:CampaignCommanderLoadoutRating_d',
      'Default:CampaignBackpackRating_d',
    ])
    const update: Record<string, string> = { ...workingTaxiMemberMeta }
    const keys = Object.keys(member.meta.schema ?? {}).filter(
      (key) => key.startsWith('Default:') && !(key in update) && !keep.has(key),
    )

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (accountService.client.http as any).epicgamesRequest(
        {
          method: 'PATCH',
          url: `https://party-service-prod.ol.epicgames.com/party/api/v1/Fortnite/parties/${accountService.client.party?.id}/members/${me.id}/meta`,
          headers: { 'Content-Type': 'application/json' },
          data: { delete: keys, revision: member.revision, update },
        },
        'fortnite',
      )
      member.revision += 1

      for (const key of keys) {
        delete member.meta.schema[key]
      }

      for (const [key, value] of Object.entries(update)) {
        member.meta.schema[key] = value
      }

      taxiLog(
        `${me.displayName ?? me.id}`,
        `taxi meta cloned from working taxi (${Object.keys(update).length} set, ${keys.length} removed: ${keys
          .map((key) => key.replace(/^Default:/, ''))
          .join(',')})`,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Someone else changed the meta first: take the server's revision and
      // try again (same as fnbr's sendPatchChunk).
      if (
        error?.code === 'errors.com.epicgames.social.party.stale_revision' &&
        attempt < 3
      ) {
        member.revision = parseInt(error.messageVars?.[1], 10)

        return TaxiService.removeMatchmakingMeta(accountService, attempt + 1)
      }

      taxiLog(
        `${me.displayName ?? me.id}`,
        `remove MatchmakingInfo failed: ${error?.code ?? error?.message ?? error}`,
      )
    }
  }

  private static async updatePatch(accountService: AccountService) {
    const isHigh =
      TaxiService._accounts.get(accountService.accountId)?.actions.high ??
      true
    const currentStat = isHigh ? FORTStatsNumber.HIGH : FORTStatsNumber.LOW

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mpLoadoutInfo: any =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (accountService.client.party?.me.meta.schema as any)?.[
        'Default:MpLoadout_j'
      ] ?? {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMetaInfo: Record<string, any> = {
      'Default:AthenaBannerInfo_j': JSON.stringify({
        AthenaBannerInfo: {
          bannerIconId: 'FounderTier4Banner3',
          bannerColorId: 'defaultcolor2',
        },
      }),
      'Default:AthenaCosmeticLoadout_j': JSON.stringify({
        AthenaCosmeticLoadout: {
          characterPrimaryAssetId:
            'AthenaCharacter:Character_SuperNovaTaro',
        },
      }),
    }

    if (mpLoadoutInfo?.MpLoadout?.d !== undefined) {
      newMetaInfo['Default:MpLoadout_j'] = JSON.stringify({
        MpLoadout: {
          d: JSON.stringify({
            ac: {
              i: 'Character_SuperNovaTaro',
              v: [],
            },
          }),
        },
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaInfo: Record<string, any> = {
      'Default:FORTStats_j': JSON.stringify({
        FORTStats: {
          fortitude: currentStat,
          offense: currentStat,
          resistance: currentStat,
          tech: currentStat,
          teamFortitude: 0,
          teamOffense: 0,
          teamResistance: 0,
          teamTech: 0,
          fortitude_Phoenix: currentStat,
          offense_Phoenix: currentStat,
          resistance_Phoenix: currentStat,
          tech_Phoenix: currentStat,
          teamFortitude_Phoenix: 0,
          teamOffense_Phoenix: 0,
          teamResistance_Phoenix: 0,
          teamTech_Phoenix: 0,
        },
      }),
      // Same PackedState as the working PennyReverse taxi. The
      // banner/outfit (newMetaInfo) are no longer sent.
      'Default:PackedState_j': JSON.stringify({
        PackedState: {
          subGame: 'Campaign',
          location: 'PreLobby',
          gameMode: 'None',
          voiceChatStatus: 'PartyVoice',
          hasCompletedSTWTutorial: true,
          hasPurchasedSTW: true,
          platformSupportsSTW: true,
          bReturnToLobbyAndReadyUp: false,
          bAnyoneChangeSelectedExperience: false,
          bDownloadOnDemandActive: false,
          bIsPartyLFG: false,
          bShouldRecordPartyChannel: false,
          bReadyForTravel: false,
          bIsInAllSelectExperiment: true,
        },
      }),
    }
    void newMetaInfo

    if (isHigh) {
      metaInfo['Default:CampaignCommanderLoadoutRating_d'] = '999.00'
      metaInfo['Default:CampaignBackpackRating_d'] = '999.000000'
    }

    try {
      await accountService.client.party?.me?.sendPatch(metaInfo)
    } catch (error) {
      //
    }
  }

  private static async refreshData(
    accountId: string,
    removeAccount?: boolean,
  ) {
    const automation = TaxiService._accounts
      .filter((account) => account.accountId !== accountId)
      .map((account) => account)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .reduce((accumulator, { status, ...account }) => {
        accumulator[account.accountId] = account

        return accumulator
      }, {} as TaxiServiceAccountFileDataList)

    if (removeAccount) {
      TaxiService._accounts.delete(accountId)
      TaxiService._services.delete(accountId)
    }

    await DataDirectory.updateTaxiServiceFile(automation)

    MainWindow.send(
      ElectronAPIEventKeys.TaxiServiceServiceResponseData,
      automation,
      true,
    )
  }

  private static updateAccountData(
    accountId: string,
    data: Partial<{
      actions: Partial<TaxiServiceAccountData['actions']>
      status: Partial<TaxiServiceAccountData['status']>
    }>,
  ) {
    const automationAccount = TaxiService.getAccountById(accountId)

    if (automationAccount) {
      const accountService = TaxiService._services.get(
        automationAccount.accountId,
      )

      const actionsNewValueHigh =
        data.actions?.high ?? automationAccount.actions.high
      const actionsNewValueDenyFriendsRequests =
        data.actions?.denyFriendsRequests ??
        automationAccount.actions.denyFriendsRequests
      const actionsNewValueActiveStatus =
        data.actions?.activeStatus ??
        automationAccount.actions.activeStatus
      const actionsNewValueBusyStatus =
        data.actions?.busyStatus ?? automationAccount.actions.busyStatus

      TaxiService._accounts.set(accountId, {
        accountId,
        actions: {
          high: actionsNewValueHigh,
          denyFriendsRequests: actionsNewValueDenyFriendsRequests,
          activeStatus: actionsNewValueActiveStatus.trim(),
          busyStatus: actionsNewValueBusyStatus.trim(),
        },
        status: data.status ?? automationAccount.status,
      })

      if (accountService) {
        if (automationAccount.actions.high !== actionsNewValueHigh) {
          TaxiService.updatePatch({
            accountId: accountService.accountId,
            client: accountService.client,
            status: accountService.status,
            currentTimeout: accountService.currentTimeout,
          })
        }

        if (
          automationAccount.actions.activeStatus !==
            actionsNewValueActiveStatus &&
          accountService.status === AccountPresence.Active
        ) {
          accountService.client.setStatus(
            actionsNewValueActiveStatus.trim().length > 0
              ? actionsNewValueActiveStatus.trim()
              : 'Free',
            'away',
          )
        } else if (
          automationAccount.actions.busyStatus !==
            actionsNewValueBusyStatus &&
          accountService.status === AccountPresence.DnD
        ) {
          accountService.client.setStatus(
            actionsNewValueBusyStatus.trim().length > 0
              ? actionsNewValueBusyStatus.trim()
              : 'Busy',
            'away',
          )
        }

        if (
          !automationAccount.actions.denyFriendsRequests &&
          actionsNewValueDenyFriendsRequests
        ) {
          const account = AccountsManager.getAccountById(accountId)!

          Authentication.verifyAccessToken(account).then((accessToken) => {
            if (!accessToken) {
              return
            }

            const pendingList =
              accountService.client.friend.pendingList.filter(
                (item) => item.direction === 'INCOMING',
              )

            pendingList.forEach((pending) => {
              removeFriend({
                accessToken,
                accountId: account.accountId,
                friendId: pending.id,
              })
            })
          })
        }
      }
    }
  }
}
