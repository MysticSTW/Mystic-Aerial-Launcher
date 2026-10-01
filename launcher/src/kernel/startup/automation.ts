import type {
  AutomationAccountData,
  AutomationAccountFileData,
  AutomationAccountServerData,
  AutomationServiceActionConfig,
  AutomationServiceStatusResponse,
} from '../../types/automation'

import { Collection } from '@discordjs/collection'
import { renameSync, statSync } from 'node:fs'
import { appendFile } from 'node:fs/promises'
import path from 'node:path'

import { AutomationStatusType } from '../../config/constants/automation'
import { ElectronAPIEventKeys } from '../../config/constants/main-process'

import { AccountService } from '../core/automation/account-service'
import { MCPStorageTransfer } from '../core/mcp/storage-transfer'
import { Authentication } from '../core/authentication'
import { ClaimRewards } from '../core/claim-rewards'
import { MainWindow } from './windows/main'
import { AccountsManager } from './accounts'
import { DataDirectory } from './data-directory'
import { SettingsManager } from './settings'

import { AutomationState } from '../../state/stw-operations/automation'

import { getQueryProfile } from '../../services/endpoints/mcp'
import { fetchParty } from '../../services/endpoints/party'

import {
  isMCPQueryProfileChangesCardPack,
  isMCPQueryProfileChangesQuest,
} from '../../lib/check-objects'

const maxRetries = 3

/**
 * Plain text log of what Auto Claim does (local time), so a stuck reward
 * screen can be matched against when the claim happened:
 * %APPDATA%\mystic-launcher-data\autoclaim-log.txt
 */
let claimLogChecked = false

function claimLog(accountId: string, message: string) {
  const name = AccountsManager.getAccountById(accountId)?.displayName ?? accountId
  const now = new Date()
  const time = `${now.toLocaleDateString('en-NZ')} ${now.toLocaleTimeString('en-NZ', { hour12: false })}.${`${now.getMilliseconds()}`.padStart(3, '0')}`
  const file = path.join(
    `${process.env.APPDATA}`,
    'mystic-launcher-data',
    'autoclaim-log.txt',
  )

  // Once per session: start a fresh log when it gets big (the old one is
  // kept as autoclaim-log.old.txt).
  if (!claimLogChecked) {
    claimLogChecked = true

    try {
      if (statSync(file).size > 1_000_000) {
        renameSync(file, file.replace(/\.txt$/, '.old.txt'))
      }
    } catch {
      //
    }
  }

  appendFile(file, `${time} [${name}] ${message}\n`).catch(() => {})
}

export class Automation {
  private static _accounts: Collection<
    string,
    AutomationAccountServerData
  > = new Collection()
  private static _services: Collection<string, AccountService> =
    new Collection()
  private static _retryCounters: Collection<string, number> =
    new Collection()

  private static _activeChecks: Record<string, NodeJS.Timeout | null> = {}
  private static _missionActive: Record<string, boolean> = {}
  // Rewards show up a little after the mission ends, so checks keep running
  // for a while after it; this stops them if nothing turns up.
  private static _afterMissionTimers: Record<string, NodeJS.Timeout | null> =
    {}
  // Accounts with a reward check in progress (see the mission interval).
  private static _checkRunning = new Set<string>()
  // Bumped on every start(), so an older start that finishes late is dropped.
  private static _startGeneration: Record<string, number> = {}
  // Accounts whose start() is still getting a token.
  private static _starting = new Set<string>()
  // Last party state / pending rewards written to autoclaim-log.txt, so the
  // log only gets a line when something changes.
  private static _lastLoggedState: Record<string, string> = {}
  private static _lastLoggedPending: Record<string, string> = {}

  /** Writes a line to autoclaim-log.txt (also used by Claim Rewards). */
  static log(accountId: string, message: string) {
    claimLog(accountId, message)
  }

  static async load() {
    const { automation } = await DataDirectory.getAutomationFile()
    const accounts = AccountsManager.getAccounts()

    Object.values(automation).forEach((data) => {
      if (!accounts.has(data.accountId)) {
        return
      }

      // load() runs every time the Automation page asks for its data (and
      // after window reloads). Only start accounts that aren't running or
      // starting yet, otherwise duplicate connections claim/kick twice.
      if (
        Automation._services.has(data.accountId) ||
        Automation._starting.has(data.accountId)
      ) {
        return
      }

      Automation._accounts.set(data.accountId, {
        ...data,
        status: AutomationStatusType.LOADING,
      })
      Automation.start(data)
    })

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.AutomationServiceResponseData,
      automation,
      false,
    )
  }

  static async addAccount(accountId: string) {
    const result = await DataDirectory.getAutomationFile()
    const data = {
      accountId,
      actions: {
        claim: false,
        kick: false,
        transferMats: false,
      },
    }

    await DataDirectory.updateAutomationFile({
      ...result.automation,
      [accountId]: data,
    })
    Automation._accounts.set(data.accountId, {
      ...data,
      status: AutomationStatusType.LOADING,
    })
    Automation.start(data)
  }

  static async removeAccount(accountId: string) {
    Automation.updateAccountData(accountId, {
      status: AutomationStatusType.LOADING,
    })
    // Automation.getProcessByAccountId(accountId)?.clearMissionIntervalId()
    // Cancels a start() that is still getting its token.
    delete Automation._startGeneration[accountId]
    Automation._starting.delete(accountId)
    Automation.clearActiveChecks([accountId])
    Automation.getServiceByAccountId(accountId)?.destroy()

    await Automation.refreshData(accountId, true)
  }

  static async updateAction(
    accountId: string,
    config: AutomationServiceActionConfig,
  ) {
    Automation.updateAccountData(accountId, {
      actions: {
        [config.type]: config.value,
      },
    })

    const current = Automation._accounts.get(accountId)

    if (!current) {
      return
    }

    const result = await DataDirectory.getAutomationFile()
    const data = {
      accountId,
      actions: {
        ...current.actions,
        [config.type]: config.value,
      },
    }

    await DataDirectory.updateAutomationFile({
      ...result.automation,
      [accountId]: data,
    })
  }

  static start(data: AutomationAccountFileData) {
    // Never run two connections for the same account: shut down the old one
    // (and its mission timer) before starting a new one.
    Automation.getServiceByAccountId(data.accountId)?.destroy()
    Automation._services.delete(data.accountId)
    Automation.clearActiveChecks([data.accountId])

    const generation = (Automation._startGeneration[data.accountId] ?? 0) + 1

    Automation._startGeneration[data.accountId] = generation
    Automation._starting.add(data.accountId)

    const isCurrent = () =>
      Automation._startGeneration[data.accountId] === generation
    const doneStarting = () => {
      if (isCurrent()) {
        Automation._starting.delete(data.accountId)
      }
    }

    const setNewStatus = (status: AutomationStatusType) => {
      claimLog(data.accountId, `status ${status}`)
      Automation.updateAccountData(data.accountId, {
        status,
      })
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.AutomationServiceStartNotification,
        {
          accountId: data.accountId,
          status,
        } as AutomationServiceStatusResponse,
      )
    }

    setNewStatus(AutomationStatusType.LOADING)

    const account = AccountsManager.getAccountById(data.accountId)!

    Authentication.verifyAccessToken(account)
      .then((accessToken) => {
        // A newer start() (or a removal) happened while this one was
        // getting its token: drop this one.
        if (!isCurrent()) {
          return
        }

        doneStarting()

        if (accessToken) {
          const accountService = new AccountService({
            accessToken,
            account,
          })

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
                  (Automation._retryCounters.get(account.accountId) ?? 0) <
                  maxRetries
                ) {
                  Automation.reload(account.accountId)
                } else {
                  this.clearActiveChecks([account.accountId])
                  Automation._retryCounters.delete(account.accountId)
                }
              } else {
                Automation.reload(account.accountId)
              }
            }
          }
          const disconnect = () => {
            setNewStatus(AutomationStatusType.DISCONNECTED)

            if (!Automation._retryCounters.has(account.accountId)) {
              Automation._retryCounters.set(account.accountId, 0)
            }

            Automation._retryCounters.set(
              account.accountId,
              (Automation._retryCounters.get(account.accountId) ?? 0) + 1,
            )

            reAuth({ code: 'disconnect' })
          }

          const initTimeout = setTimeout(() => {
            setNewStatus(AutomationStatusType.ERROR)
            disconnect()
          }, 10_000) // 10 seconds

          accountService.onceSessionStarted(async () => {
            setNewStatus(AutomationStatusType.LISTENING)
            clearTimeout(initTimeout)
            // Connected again: the retry limit is for back-to-back failures,
            // not for every disconnect in a long session.
            Automation._retryCounters.delete(account.accountId)

            try {
              const response = await fetchParty({
                accessToken,
                accountId: account.accountId,
              })
              const party = response.data.current?.[0]

              if (party) {
                this.checkJoiningExistingSession({
                  accountId: account.accountId,
                  meta: party.meta,
                })
              }
            } catch (error) {
              //
            }
          })

          accountService.onDisconnected(() => {
            disconnect()
          })
          accountService.onMemberDisconnected((member) => {
            if (!member.ns || member.ns?.toLowerCase() !== 'fortnite') {
              return
            }

            if (member.account_id === accountService.accountId) {
              disconnect()
            }
          })
          accountService.onMemberExpired((member) => {
            if (!member.ns || member.ns?.toLowerCase() !== 'fortnite') {
              return
            }

            if (member.account_id === accountService.accountId) {
              disconnect()
            }
          })

          accountService.onPartyUpdated(async (value) => {
            try {
              this.checkJoiningExistingSession({
                accountId: account.accountId,
                meta: value.party_state_updated,
              })
            } catch (errro) {
              //
            }
          })

          accountService.onMemberJoined((member) => {
            if (!member.ns || member.ns?.toLowerCase() !== 'fortnite') {
              return
            }

            if (member.account_id === accountService.accountId) {
              setTimeout(async () => {
                try {
                  const account = AccountsManager.getAccountById(
                    accountService.accountId,
                  )

                  if (!account) {
                    return
                  }

                  const accessToken =
                    await Authentication.verifyAccessToken(account)

                  if (!accessToken) {
                    return
                  }

                  const response = await fetchParty({
                    accessToken,
                    accountId: account.accountId,
                  })
                  const party = response.data.current?.[0]

                  if (party) {
                    this.checkJoiningExistingSession({
                      accountId: account.accountId,
                      meta: party.meta,
                    })
                  }
                } catch (error) {
                  //
                }
              }, 8000)
            }
          })

          Automation._services.set(
            accountService.accountId,
            accountService,
          )

          return
        }

        setNewStatus(AutomationStatusType.ERROR)
      })
      .catch(() => {
        doneStarting()
        setNewStatus(AutomationStatusType.ERROR)
      })
  }

  static async reload(accountId: string) {
    const current = Automation._accounts.get(accountId)

    if (!current) {
      return
    }

    Automation.getServiceByAccountId(accountId)?.destroy()
    Automation._services.delete(accountId)
    this.clearActiveChecks([current.accountId])

    Automation.start(current)
  }

  static getAccountById(
    accountId: string,
  ): AutomationAccountServerData | undefined {
    return Automation._accounts.get(accountId)
  }

  static getServices() {
    return Automation._services.clone()
  }

  static getServiceByAccountId(accountId: string) {
    return Automation._services.find(
      (accountService) => accountService.accountId === accountId,
    )
  }

  static async checkJoiningExistingSession({
    accountId,
    meta,
  }: {
    accountId: string
    meta: Partial<Record<string, string>>
  }) {
    try {
      const automationAccount = Automation.getAccountById(accountId)

      if (!automationAccount) {
        return
      }

      if (
        !automationAccount.actions.claim &&
        !automationAccount.actions.transferMats
      ) {
        return
      }

      const partyState = meta['Default:PartyState_s'] ?? ''

      if (partyState && Automation._lastLoggedState[accountId] !== partyState) {
        Automation._lastLoggedState[accountId] = partyState
        claimLog(accountId, `party state ${partyState}`)
      }

      if (partyState) {
        if (partyState === 'PostMatchmaking') {
          if (Automation._missionActive[accountId]) {
            return
          }

          if (Automation._missionActive[accountId] === undefined) {
            Automation._missionActive[accountId] = false
          }

          const settings = await SettingsManager.getData()
          const missionInterval = Number(settings.missionInterval)

          // Stops checks still running from the last mission, so there's
          // never more than one timer per account.
          this.clearActiveChecks([accountId])
          Automation._missionActive[accountId] = true
          delete Automation._lastLoggedPending[accountId]
          claimLog(
            accountId,
            `mission started, checking for rewards every ${missionInterval}s`,
          )
          Automation._activeChecks[accountId] = setInterval(async () => {
            // A check can take longer than the interval when Epic is slow;
            // overlapping checks would both see the rewards and claim twice.
            if (Automation._checkRunning.has(accountId)) {
              return
            }

            Automation._checkRunning.add(accountId)

            try {
              const account = AccountsManager.getAccountById(accountId)

              if (!account) {
                this.clearActiveChecks([accountId])

                return
              }

              const accessToken =
                await Authentication.verifyAccessToken(account)

              if (!accessToken) {
                this.clearActiveChecks([accountId])

                return
              }

              const response = await getQueryProfile({
                accessToken,
                accountId,
              })
              const profileChanges =
                response.data.profileChanges[0] ?? null

              const pendingMissionAlertRewardsTotal =
                profileChanges?.profile.stats.attributes
                  .mission_alert_redemption_record
                  ?.pendingMissionAlertRewards?.items.length ?? 0
              const pendingDifficultyIncreaseRewardsTotal =
                profileChanges?.profile.stats.attributes
                  .difficulty_increase_rewards_record?.pendingRewards
                  .length ?? 0

              const items = Object.entries(
                profileChanges?.profile?.items ?? {},
              )
              const pendingRewards = items
                .filter(
                  ([, itemValue]) =>
                    (isMCPQueryProfileChangesCardPack(itemValue) &&
                      (itemValue.attributes.match_statistics ||
                        itemValue.attributes.pack_source ===
                          'ItemCache')) ||
                    (isMCPQueryProfileChangesQuest(itemValue) &&
                      itemValue.attributes.quest_state === 'Completed'),
                )
                .map(([itemKey]) => itemKey)

              const pending = `alerts=${pendingMissionAlertRewardsTotal} difficulty=${pendingDifficultyIncreaseRewardsTotal} packs/quests=${pendingRewards.length}`

              if (Automation._lastLoggedPending[accountId] !== pending) {
                Automation._lastLoggedPending[accountId] = pending
                claimLog(accountId, `pending rewards: ${pending}`)
              }

              if (
                pendingMissionAlertRewardsTotal > 0 ||
                pendingDifficultyIncreaseRewardsTotal > 0 ||
                pendingRewards.length > 0
              ) {
                const automationAccount =
                  Automation.getAccountById(accountId)

                if (!automationAccount) {
                  this.clearActiveChecks([accountId])

                  return
                }

                this.clearActiveChecks([accountId])

                // Claim first so claimed materials are included in the transfer.
                if (automationAccount.actions.claim) {
                  const claimStarted = Date.now()

                  claimLog(accountId, 'claiming rewards...')
                  await ClaimRewards.start([account], true)
                    .then((result) =>
                      claimLog(
                        accountId,
                        `claim finished in ${Date.now() - claimStarted}ms (${result ? `${result.length} notification(s)` : 'nothing returned'})`,
                      ),
                    )
                    .catch((error) =>
                      claimLog(
                        accountId,
                        `claim FAILED after ${Date.now() - claimStarted}ms: ${error?.message ?? error}`,
                      ),
                    )
                }

                // With Claim on, Claim Rewards already runs the transfer after
                // claiming; only run it here when Claim is off (it used to
                // run twice).
                if (
                  automationAccount.actions.transferMats &&
                  !automationAccount.actions.claim
                ) {
                  claimLog(accountId, 'transfer mats started')
                  MCPStorageTransfer.buildingMaterials(account)
                    .then((result) =>
                      claimLog(accountId, `transfer mats: ${result}`),
                    )
                    .catch(() => {})
                }
              }
            } catch (error) {
              claimLog(
                accountId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                `reward check error: ${(error as any)?.message ?? error}`,
              )
            } finally {
              Automation._checkRunning.delete(accountId)
            }
          }, missionInterval * 1_000)
        } else if (Automation._missionActive[accountId]) {
          const removeCheck = async () => {
            try {
              const account = AccountsManager.getAccountById(accountId)

              if (!account) {
                return true
              }

              const accessToken =
                await Authentication.verifyAccessToken(account)

              if (!accessToken) {
                return true
              }

              const response = await fetchParty({
                accessToken,
                accountId: account.accountId,
              })
              const party = response.data.current?.[0]

              if (party) {
                const partyState = meta['Default:PartyState_s'] ?? ''

                if (partyState === 'PostMatchmaking') {
                  return false
                }
              }
            } catch (error) {
              //
            }

            return true
          }

          const remove = await removeCheck()

          if (remove) {
            Automation._missionActive[accountId] = false

            // Rewards usually land a few seconds after the mission ends, so
            // keep checking for a minute instead of stopping straight away.
            // A claim (or a new mission) stops the checks earlier.
            if (Automation._activeChecks[accountId]) {
              claimLog(
                accountId,
                `mission over (party state ${partyState}), checking for rewards for 60 more seconds`,
              )

              if (Automation._afterMissionTimers[accountId]) {
                clearTimeout(Automation._afterMissionTimers[accountId])
              }

              Automation._afterMissionTimers[accountId] = setTimeout(() => {
                Automation._afterMissionTimers[accountId] = null

                if (Automation._activeChecks[accountId]) {
                  claimLog(accountId, 'no rewards after mission, stopped checking')
                  this.clearActiveChecks([accountId])
                }
              }, 60_000)
            }
          }
        }
      }
    } catch (error) {
      //
    }
  }

  static clearActiveChecks(accountIds: Array<string> | null) {
    const ids =
      accountIds === null
        ? Object.keys(Automation._activeChecks)
        : accountIds

    ids.forEach((accountId) => {
      if (
        Automation._activeChecks[accountId] !== undefined &&
        Automation._activeChecks[accountId] !== null
      ) {
        clearInterval(Automation._activeChecks[accountId])
        Automation._activeChecks[accountId] = null
      }

      if (Automation._afterMissionTimers[accountId]) {
        clearTimeout(Automation._afterMissionTimers[accountId])
        Automation._afterMissionTimers[accountId] = null
      }

      // Otherwise a restart mid-mission leaves the flag set and the
      // mission check never starts again for that mission.
      Automation._missionActive[accountId] = false
    })
  }

  private static async refreshData(
    accountId: string,
    removeAccount?: boolean,
  ) {
    const automation = Automation._accounts
      .filter((account) => account.accountId !== accountId)
      .map((account) => account)
      .reduce(
        (accumulator, account) => {
          accumulator[account.accountId] = {
            ...account,
          }

          return accumulator
        },
        {} as Parameters<AutomationState['refreshAccounts']>[0],
      )

    if (removeAccount) {
      Automation._accounts.delete(accountId)
      Automation._services.delete(accountId)
    }

    await DataDirectory.updateAutomationFile(automation)

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.AutomationServiceResponseData,
      automation,
      true,
    )
  }

  private static updateAccountData(
    accountId: string,
    data: Partial<{
      actions: Partial<AutomationAccountData['actions']>
      status: Partial<AutomationAccountData['status']>
    }>,
  ) {
    const automationAccount = Automation.getAccountById(accountId)

    if (automationAccount) {
      const actionsNewValueClaim =
        data.actions?.claim ?? automationAccount.actions.claim
      // Kick was removed (see archive/removed-features); always stored off.
      const actionsNewValueKick = false
      const actionsNewValueTransferMats =
        data.actions?.transferMats ??
        automationAccount.actions.transferMats

      if (data.actions) {
        if (
          (!automationAccount.actions.claim && actionsNewValueClaim) ||
          (!automationAccount.actions.transferMats &&
            actionsNewValueTransferMats)
        ) {
          if (typeof Automation._activeChecks[accountId] !== 'number') {
            const check = async () => {
              try {
                const account = AccountsManager.getAccountById(accountId)

                if (!account) {
                  return
                }

                const accessToken =
                  await Authentication.verifyAccessToken(account)

                if (!accessToken) {
                  return
                }

                const response = await fetchParty({
                  accessToken,
                  accountId,
                })
                const party = response.data.current?.[0]

                if (party) {
                  this.checkJoiningExistingSession({
                    accountId,
                    meta: party.meta,
                  })
                }
              } catch (error) {
                //
              }
            }

            check()
          }
        } else if (!actionsNewValueClaim && !actionsNewValueTransferMats) {
          this.clearActiveChecks([accountId])
        }
      }

      Automation._accounts.set(accountId, {
        accountId,
        actions: {
          claim: actionsNewValueClaim,
          kick: actionsNewValueKick,
          transferMats: actionsNewValueTransferMats,
        },
        status: data.status ?? automationAccount.status,
      })
    }
  }
}
