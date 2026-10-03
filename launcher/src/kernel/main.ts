import type {
  SaveWorldInfoData,
  WorldInfoFileData,
} from '../types/data/advanced-mode/world-info'
import type {
  AccountBasicInfo,
  AccountData,
  AccountDataList,
  AccountDataRecord,
  AccountList,
} from '../types/accounts'
import type { AlertsDoneSearchPlayerConfig } from '../types/alerts'
import type { AuthenticationByDeviceProperties } from '../types/authentication'
import type { AutomationServiceActionConfig } from '../types/automation'
import type { GroupRecord } from '../types/groups'
import type { CustomizableMenuSettings, Settings } from '../types/settings'
import type { TagRecord } from '../types/tags'
import type { TaxiServiceServiceActionConfig } from '../types/taxi-service'
import type {
  XPBoostsConsumePersonalData,
  XPBoostsConsumeTeammateData,
  XPBoostsSearchUserConfig,
} from '../types/xpboosts'

import path from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import squirrelStartup from 'electron-squirrel-startup'
import schedule from 'node-schedule'

import { repositoryURL } from '../config/about/links'
import { ElectronAPIEventKeys } from '../config/constants/main-process'

import { AlertsDone } from './core/alerts'
// import { AntiCheatProvider } from './core/anti-cheat-provider'
import { Authentication } from './core/authentication'
import { ClaimRewards } from './core/claim-rewards'
import { DevicesAuthManager } from './core/devices-auth'
import { EULATracking } from './core/eula-tracking'
import { FortniteLauncher } from './core/launcher'
import { LlamaShop } from './core/llama-shop'
import { MCPClientQuestLogin, MCPDailyQuests } from './core/mcp'
import { MatchmakingTrack } from './core/matchmaking-track'
import { Manifest } from './core/manifest'
import { Party } from './core/party'
import { RedeemCodes } from './core/redeem-codes'
import { VBucksInformation } from './core/vbucks-information'
import { WorldInfoManager } from './core/world-info'
import { XPBoostsManager } from './core/xpboosts'
import { MainWindow } from './startup/windows/main'
import { AccountsManager } from './startup/accounts'
import { Application } from './startup/application'
import {
  AutoLlamas,
  ProcessAutoLlamas,
  ProcessLlamaType,
} from './startup/auto-llamas'
import { AutoPinUrns } from './startup/auto-pin-urns'
import { Automation } from './startup/automation'
import { DataDirectory } from './startup/data-directory'
import { GroupsManager } from './startup/groups'
import {
  AppLanguage,
  CustomizableMenuSettingsManager,
  DevSettingsManager,
  SettingsManager,
} from './startup/settings'
import { SystemTray } from './startup/system-tray'
import { TagsManager } from './startup/tags'
import { TaxiService } from './startup/taxi-service'
import {
  baseWindowSize,
  defaultWindowSize,
  getSavedWindowBounds,
  manageWindowState,
} from './startup/window-state'

import {
  AutoLlamasAccountAddParams,
  AutoLlamasAccountUpdateParams,
} from '../state/stw-operations/auto/llamas'

import { Language } from '../locales/resources'
import { CustomProcess } from './core/custom-process'

// Handle creating/removing the Start menu and desktop shortcuts when the
// installer installs, updates or uninstalls the app, then quit.
const isSquirrelEvent = squirrelStartup as boolean

if (isSquirrelEvent) {
  app.quit()
}

const gotTheLock = app.requestSingleInstanceLock()

function isAllowedExternalURL(url: string) {
  try {
    const parsed = new URL(url)
    const repository = new URL(repositoryURL)

    // Epic Games pages, plus this launcher's own GitHub repo (Check for
    // updates). Nothing else is opened.
    return (
      parsed.hostname === 'www.epicgames.com' ||
      (parsed.protocol === 'https:' &&
        parsed.hostname === repository.hostname &&
        (parsed.pathname === repository.pathname ||
          parsed.pathname.startsWith(`${repository.pathname}/`)))
    )
  } catch {
    return false
  }
}

;(() => {
  if (!gotTheLock) {
    return app.quit()
  }

  const createWindow = async () => {
    // Create the browser window.
    const savedBounds = getSavedWindowBounds()
    const mainWindow = new BrowserWindow({
      center: savedBounds.x === undefined,
      frame: false,
      height: savedBounds.height ?? defaultWindowSize.height,
      width: savedBounds.width ?? defaultWindowSize.width,
      x: savedBounds.x,
      y: savedBounds.y,
      // Below the base size the UI zooms down to 60% (see manageWindowState).
      minHeight: Math.round(baseWindowSize.height * 0.6),
      minWidth: Math.round(baseWindowSize.width * 0.6),
      show: false,
      backgroundColor: '#0f172a',
      webPreferences: {
        devTools: !app.isPackaged,
        preload: path.join(__dirname, 'preload.js'),
        spellcheck: false,
      },
    })

    manageWindowState(mainWindow)

    const manifest = Manifest.getData()

    if (manifest) {
      mainWindow.webContents.setUserAgent(manifest.UserAgent)
    }

    const showFallback = async (
      heading: string,
      details: string,
    ) => {
      const safeHeading = heading
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
      const safeDetails = details
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')

      const html = `<!doctype html><html><body style="margin:0;background:#0f172a;color:#e2e8f0;font-family:Segoe UI,Arial,sans-serif;"><main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;"><section style="max-width:900px;width:100%;border:1px solid #334155;background:#111827;border-radius:12px;padding:20px;"><h2 style="margin:0 0 12px 0;">${safeHeading}</h2><p style="margin:0 0 12px 0;color:#93c5fd;">Mystic Launcher could not render the interface.</p><pre style="white-space:pre-wrap;word-break:break-word;background:#030712;border:1px solid #374151;border-radius:8px;padding:12px;margin:0;color:#fca5a5;">${safeDetails}</pre></section></main></body></html>`

      await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
    }

    mainWindow.webContents.on(
      'did-fail-load',
      async (_, errorCode, errorDescription, validatedURL) => {
        await showFallback(
          'Failed to load application window',
          `Code: ${errorCode}\nURL: ${validatedURL}\nDetails: ${errorDescription}`,
        )
      },
    )

    const loadApp = async () => {
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
      } else {
        await mainWindow.loadFile(
          path.join(
            __dirname,
            `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
          ),
        )
      }
    }

    // A one-off renderer/GPU crash (e.g. very fast theme switching on a weak
    // GPU) reloads the app by itself. Only repeated crashes show the error
    // screen.
    const recentCrashes: Array<number> = []

    mainWindow.webContents.on('render-process-gone', async (_, details) => {
      if (mainWindow.isDestroyed() || details.reason === 'clean-exit') {
        return
      }

      const now = Date.now()

      recentCrashes.push(now)

      while (recentCrashes.length > 0 && now - recentCrashes[0]! > 60_000) {
        recentCrashes.shift()
      }

      if (recentCrashes.length < 3) {
        try {
          await loadApp()

          return
        } catch {
          //
        }
      }

      await showFallback(
        'Renderer process terminated',
        `Reason: ${details.reason}\nExit code: ${details.exitCode}`,
      )
    })

    // With the system tray on, closing the window any other way than the
    // app's own X (Alt+F4, the taskbar's "Close window") only hides it. A
    // destroyed window left the tray app running with nothing to talk to.
    mainWindow.on('close', (event) => {
      if (SystemTray.isActive && !MainWindow.isQuitting) {
        event.preventDefault()
        mainWindow.hide()
      }
    })

    // Never block Windows from shutting down or signing out.
    mainWindow.on('query-session-end', () => {
      MainWindow.setQuitting()
    })

    mainWindow.once('ready-to-show', () => {
      mainWindow.show()
    })

    mainWindow.webContents.once('did-finish-load', () => {
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
    })

    // and load the index.html of the app.
    if (
      MAIN_WINDOW_VITE_DEV_SERVER_URL &&
      process.env.OPEN_DEVTOOLS === 'true'
    ) {
      mainWindow.webContents.openDevTools({
        mode: 'undocked',
      })
    }

    await loadApp()

    return mainWindow
  }

  Menu.setApplicationMenu(null)

  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (MainWindow.isAvailable) {
      if (SystemTray.isActive) {
        if (!MainWindow.instance.isVisible()) {
          MainWindow.instance.show()
        }
      } else {
        if (MainWindow.instance.isMinimized()) {
          MainWindow.instance.restore()
        }
      }

      MainWindow.instance.focus()
    }
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', async () => {
    DataDirectory.createDataResources().catch(() => {})

    MainWindow.setInstance(await createWindow())

    /**
     * Paths
     */

    ipcMain.on(ElectronAPIEventKeys.GetMatchmakingTrackPath, async () => {
      MainWindow.send(
        ElectronAPIEventKeys.GetMatchmakingTrackPathNotification,
        DataDirectory.matchmakingFilePath,
      )
    })

    /**
     * Settings
     */

    ipcMain.on(ElectronAPIEventKeys.AppLanguageRequest, async () => {
      await AppLanguage.load()
    })

    ipcMain.on(
      ElectronAPIEventKeys.AppLanguageUpdate,
      async (_, language: Language) => {
        await AppLanguage.update(language)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.RequestAccounts, async () => {
      await AccountsManager.load()
    })

    ipcMain.on(ElectronAPIEventKeys.RequestSettings, async () => {
      await SettingsManager.load()
    })

    ipcMain.on(ElectronAPIEventKeys.DevSettingsRequest, async () => {
      await DevSettingsManager.load()
    })

    ipcMain.on(
      ElectronAPIEventKeys.CustomizableMenuSettingsRequest,
      async () => {
        await CustomizableMenuSettingsManager.load()
      },
    )

    ipcMain.on(ElectronAPIEventKeys.RequestTags, async () => {
      await TagsManager.load()
    })

    ipcMain.on(ElectronAPIEventKeys.RequestGroups, async () => {
      await GroupsManager.load()
    })

    ipcMain.on(
      ElectronAPIEventKeys.UpdateSettings,
      async (_, settings: Settings) => {
        await SettingsManager.update(settings)
      },
    )

    ipcMain.handle(ElectronAPIEventKeys.SettingsDetectPath, () => {
      return SettingsManager.detectGamePath({
        namespaceId: 'fn',
      })
    })

    ipcMain.on(
      ElectronAPIEventKeys.AccountsOrderingSync,
      async (_, accounts: AccountDataRecord) => {
        await AccountsManager.reorder(accounts)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.CustomizableMenuSettingsUpdate,
      async (
        _,
        key: keyof CustomizableMenuSettings,
        visibility: boolean,
      ) => {
        await CustomizableMenuSettingsManager.update(key, visibility)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.UpdateTags,
      async (_, tags: TagRecord) => {
        await TagsManager.update(tags)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.UpdateGroups,
      async (_, groups: GroupRecord) => {
        await GroupsManager.update(groups)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.CustomProcessKill, () => {
      CustomProcess.kill()
    })

    /**
     * General Methods
     */

    ipcMain.on(ElectronAPIEventKeys.OpenExternalURL, (_, url: string) => {
      if (isAllowedExternalURL(url)) {
        shell.openExternal(url)
      }
    })

    ipcMain.on(ElectronAPIEventKeys.CloseWindow, () => {
      if (SystemTray.isActive) {
        MainWindow.closeApp()
      } else {
        MainWindow.instance.close()
      }
    })

    ipcMain.on(ElectronAPIEventKeys.MinimizeWindow, () => {
      if (SystemTray.isActive) {
        MainWindow.instance.hide()
      } else {
        MainWindow.instance.minimize()
      }
    })

    /**
     * Events
     */

    ipcMain.on(
      ElectronAPIEventKeys.OnRemoveAccount,
      async (_, accountId: string) => {
        await AccountsManager.remove(accountId)
      },
    )

    /**
     * Requests
     */

    // ipcMain.on(
    //   ElectronAPIEventKeys.RequestProviderAndAccessTokenOnStartup,
    //   async (_, account: AccountData) => {
    //     const response = await AntiCheatProvider.request(account)

    //     MainWindow.send(
    //       ElectronAPIEventKeys.ResponseProviderAndAccessTokenOnStartup,
    //       response
    //     )
    //   }
    // )

    /**
     * Authentication
     */

    ipcMain.on(
      ElectronAPIEventKeys.CreateAuthWithExchange,
      async (_, code: string) => {
        await Authentication.exchange(code)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.CreateAuthWithAuthorization,
      async (_, code: string) => {
        await Authentication.authorization(code)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.CreateAuthWithDevice,
      async (_, data: AuthenticationByDeviceProperties) => {
        await Authentication.device(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.OpenEpicGamesSettings,
      async (_, account: AccountData) => {
        await Authentication.openEpicGamesSettings(account)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.GenerateExchangeCode,
      async (_, account: AccountData) => {
        await Authentication.generateExchangeCode(account)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.RequestNewVersionStatus, async () => {
      await Application.checkVersion()
    })

    /**
     * Launcher
     */

    ipcMain.on(
      ElectronAPIEventKeys.LauncherStart,
      async (_, account: AccountData) => {
        await FortniteLauncher.start(account)
      },
    )

    /**
     * STW Operations
     */

    ipcMain.on(
      ElectronAPIEventKeys.DailyQuestsRequest,
      async (_, accounts: Array<AccountData>) => {
        await MCPDailyQuests.request(accounts)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.DailyQuestReroll,
      async (_, account: AccountData, questId: string) => {
        await MCPDailyQuests.reroll(account, questId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.XPBoostsAccountProfileRequest,
      async (_, accounts: Array<AccountData>) => {
        await XPBoostsManager.requestAccounts(accounts)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.XPBoostsConsumePersonal,
      async (_, data: XPBoostsConsumePersonalData) => {
        await XPBoostsManager.consumePersonal(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.XPBoostsConsumeTeammate,
      async (_, data: XPBoostsConsumeTeammateData) => {
        await XPBoostsManager.consumeTeammate(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.XPBoostsSearchUser,
      async (_, config: XPBoostsSearchUserConfig) => {
        await XPBoostsManager.searchUser(
          ElectronAPIEventKeys.XPBoostsSearchUserNotification,
          config,
        )
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.XPBoostsGeneralSearchUser,
      async (_, config: XPBoostsSearchUserConfig) => {
        await XPBoostsManager.generalSearchUser(config)
      },
    )



    /**
     * Party
     */

    ipcMain.on(
      ElectronAPIEventKeys.PartyClaimAction,
      async (_, selectedAccount: Array<AccountData>) => {
        await ClaimRewards.start(selectedAccount)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.PartyKickAction,
      async (
        _,
        selectedAccount: AccountData,
        accounts: AccountDataList,
        claimState: boolean,
      ) => {
        await Party.kickPartyMembers(
          selectedAccount,
          accounts,
          claimState,
          {
            force: true,
          },
        )
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.PartyLeaveAction,
      async (
        _,
        selectedAccounts: AccountList,
        accounts: AccountDataList,
        claimState: boolean,
      ) => {
        await Party.leaveParty(selectedAccounts, accounts, claimState)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.PartyLoadFriends, async () => {
      await Party.loadFriends()
    })

    ipcMain.on(
      ElectronAPIEventKeys.PartyAddNewFriendAction,
      async (_, account: AccountData, displayName: string) => {
        await Party.addNewFriend(account, displayName)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.PartyInviteAction,
      async (_, account: AccountData, accountIds: Array<string>) => {
        await Party.invite(account, accountIds)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.PartyRemoveFriendAction,
      async (
        _,
        data: {
          accountId: string
          displayName: string
        },
      ) => {
        await Party.removeFriend(data)
      },
    )

    /**
     * Advanced Mode
     */

    ipcMain.on(
      ElectronAPIEventKeys.HomeFetchPlayerRequest,
      async (_, config: AlertsDoneSearchPlayerConfig) => {
        await AlertsDone.fetchPlayerData(config)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.HomeWorldInfoRequest, async () => {
      await WorldInfoManager.requestForHome()
    })

    ipcMain.handle(ElectronAPIEventKeys.HomeLlamaShopRequest, () => {
      return LlamaShop.request()
    })

    ipcMain.handle(ElectronAPIEventKeys.HomeWeeklyRewardRequest, () => {
      return LlamaShop.requestWeekly()
    })

    ipcMain.on(ElectronAPIEventKeys.WorldInfoRequestData, async () => {
      await WorldInfoManager.requestForAdvanceSection()
    })

    ipcMain.on(
      ElectronAPIEventKeys.WorldInfoSaveFile,
      async (_, data: SaveWorldInfoData) => {
        await WorldInfoManager.saveFile(data)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.WorldInfoRequestFiles, async () => {
      await WorldInfoManager.requestFiles()
    })

    ipcMain.on(
      ElectronAPIEventKeys.WorldInfoDeleteFile,
      async (_, data: WorldInfoFileData) => {
        await WorldInfoManager.deleteFile(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.WorldInfoExportFile,
      async (_, data: WorldInfoFileData) => {
        await WorldInfoManager.exportWorldInfoFile(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.WorldInfoOpenFile,
      async (_, data: WorldInfoFileData) => {
        await WorldInfoManager.openWorldInfoFile(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.WorldInfoRenameFile,
      async (_, data: WorldInfoFileData, newFilename: string) => {
        await WorldInfoManager.renameFile(data, newFilename)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.MatchmakingTrackSaveFile,
      async (_, account: AccountData, accountId: string) => {
        await MatchmakingTrack.saveFile(account, accountId)
      },
    )

    /**
     * Automation
     */

    ipcMain.on(
      ElectronAPIEventKeys.AutomationServiceRequestData,
      async () => {
        await Automation.load()
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutomationServiceStart,
      async (_, accountId: string) => {
        await Automation.addAccount(accountId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutomationServiceReload,
      async (_, accountId: string) => {
        await Automation.reload(accountId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutomationServiceRemove,
      async (_, accountId: string) => {
        await Automation.removeAccount(accountId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutomationServiceActionUpdate,
      async (
        _,
        accountId: string,
        config: AutomationServiceActionConfig,
      ) => {
        await Automation.updateAction(accountId, config)
      },
    )

    /**
     * Taxi Service
     */

    ipcMain.on(
      ElectronAPIEventKeys.TaxiServiceServiceAddAccounts,
      async (_, origin: Array<string>, destination: Array<string>) => {
        await TaxiService.sendRequests(origin, destination)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.TaxiServiceServiceRequestData,
      async () => {
        await TaxiService.load()
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.TaxiServiceServiceStart,
      async (_, accountId: string) => {
        await TaxiService.addAccount(accountId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.TaxiServiceServiceReload,
      async (_, ids: Array<string>) => {
        await TaxiService.reload(ids)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.TaxiServiceServiceRemove,
      async (_, accountId: string) => {
        await TaxiService.removeAccount(accountId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.TaxiServiceServiceActionUpdate,
      async (
        _,
        accountId: string,
        config: TaxiServiceServiceActionConfig,
      ) => {
        await TaxiService.updateAction(accountId, config)
      },
    )

    /**
     * Urns
     */

    ipcMain.on(ElectronAPIEventKeys.UrnsServiceRequestData, async () => {
      await AutoPinUrns.load()
    })

    ipcMain.on(
      ElectronAPIEventKeys.UrnsServiceAdd,
      async (_, accountId: string) => {
        await AutoPinUrns.addAccount(accountId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.UrnsServiceUpdate,
      async (
        _,
        accountId: string,
        type: 'mini-bosses' | 'urns',
        value: boolean,
      ) => {
        await AutoPinUrns.updateAccount(accountId, type, value)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.UrnsServiceRemove,
      async (_, accountId: string) => {
        await AutoPinUrns.removeAccount(accountId)
      },
    )

    /**
     * Auto-llamas
     */

    ipcMain.on(
      ElectronAPIEventKeys.AutoLlamasLoadAccountsRequest,
      async () => {
        await AutoLlamas.load()

        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.FreeUpgrade,
          }),
          type: ProcessLlamaType.FreeUpgrade,
        })

        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.Survivor,
          }),
          type: ProcessLlamaType.Survivor,
        })
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutoLlamasAccountAdd,
      async (_, accounts: AutoLlamasAccountAddParams) => {
        await AutoLlamas.addAccount(accounts)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutoLlamasAccountUpdate,
      async (_, data: AutoLlamasAccountUpdateParams) => {
        await AutoLlamas.updateAccounts(data)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.AutoLlamasAccountRemove,
      async (_, data: Array<string> | null) => {
        await AutoLlamas.removeAccounts(data)
      },
    )

    ipcMain.on(ElectronAPIEventKeys.AutoLlamasAccountCheck, async () => {
      await AutoLlamas.check()
    })

    /**
     * V-Bucks Information
     */

    ipcMain.on(
      ElectronAPIEventKeys.VBucksInformationRequest,
      async (_, accounts: Array<AccountData>) => {
        await VBucksInformation.requestBulkInfo(accounts)
      },
    )

    /**
     * Redeem Codes
     */

    ipcMain.on(
      ElectronAPIEventKeys.RedeemCodesRedeem,
      async (_, accounts: Array<AccountData>, codes: Array<string>) => {
        await RedeemCodes.redeem(accounts, codes)
      },
    )

    /**
     * Accounts
     */

    ipcMain.on(
      ElectronAPIEventKeys.UpdateAccountBasicInfo,
      async (_, account: AccountBasicInfo) => {
        await AccountsManager.add(account)
        MainWindow.send(
          ElectronAPIEventKeys.ResponseUpdateAccountBasicInfo,
        )
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.DevicesAuthRequestData,
      async (_, account: AccountData) => {
        await DevicesAuthManager.load(account)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.DevicesAuthRemove,
      async (_, account: AccountData, deviceId: string) => {
        await DevicesAuthManager.remove(account, deviceId)
      },
    )

    ipcMain.on(
      ElectronAPIEventKeys.EULAVerificationRequest,
      async (_, accountIds: Array<string>) => {
        await EULATracking.verify(accountIds)
      },
    )

    /**
     * Schedules
     */

    schedule.scheduleJob(
      {
        /**
         * Executes in every reset at time: 00:00:10 AM
         * Hour: 00
         * Minute: 00
         * Second: 10
         */
        rule: '10 0 0 * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      () => {
        WorldInfoManager.requestForHome().catch(() => {})
        WorldInfoManager.requestForAdvanceSection().catch(() => {})
      },
    )

    schedule.scheduleJob(
      {
        /**
         * Runs: daily every hour
         * Hour: every hour
         * Minute: 1
         */
        rule: '1 * * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      () => {
        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.FreeUpgrade,
          }),
          type: ProcessLlamaType.FreeUpgrade,
        })
      },
    )

    schedule.scheduleJob(
      {
        /**
         * Runs: every reset at time: 00:01:00 AM
         * Hour: 0 AM (midnight)
         * Minute: 1
         */
        rule: '1 0 * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      () => {
        ProcessAutoLlamas.start({
          selected: AutoLlamas.getAccounts({
            type: ProcessLlamaType.Survivor,
          }),
          type: ProcessLlamaType.Survivor,
        })
      },
    )

    /**
     * Auto Daily Quests (ClientQuestLogin)
     */

    const runAutoDailyQuests = async () => {
      const settings = await SettingsManager.getData()

      if (!settings.autoDailyQuests) {
        return
      }

      const accounts = AccountsManager.getAccounts()

      if (accounts.size > 0) {
        MCPClientQuestLogin.save([...accounts.values()])
      }
    }

    schedule.scheduleJob(
      {
        /**
         * Runs: every reset at time: 00:01:00 AM
         * Hour: 0 AM (midnight)
         * Minute: 1
         * Second: 0
         */
        rule: '0 1 0 * * *',
        /**
         * Time zone
         */
        tz: 'UTC',
      },
      runAutoDailyQuests
    )

    // Startup trigger: run once after accounts have loaded
    setTimeout(runAutoDailyQuests, 30_000)
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  // Any real quit (tray Exit, installer update) must be able to close the
  // window, see the 'close' handler in createWindow.
  app.on('before-quit', () => {
    MainWindow.setQuitting()
  })

  app.on('window-all-closed', () => {
    if (!SystemTray.isActive) {
      MainWindow.closeApp()
    }
  })

  app.on('activate', async () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      MainWindow.setInstance(await createWindow())
    }
  })

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and import them here.
})()
