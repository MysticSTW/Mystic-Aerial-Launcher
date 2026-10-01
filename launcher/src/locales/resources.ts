import type { Resource } from 'i18next'

import enUS_sidebar from './en-US/sidebar.json'
import enUS_general from './en-US/general.json'
import enUS_history from './en-US/history.json'
import enUS_settings from './en-US/settings.json'
import enUS_alerts from './en-US/home.json'
import enUS_zones from './en-US/zones.json'
import enUS_stwOperations_AutoKick from './en-US/stw-operations/auto-kick.json'
import enUS_stwOperations_TaxiService from './en-US/stw-operations/taxi-service.json'
import enUS_stwOperations_DailyQuests from './en-US/stw-operations/daily-quests.json'
import enUS_stwOperations_Party from './en-US/stw-operations/party.json'
import enUS_stwOperations_Urns from './en-US/stw-operations/urns.json'
import enUS_stwOperations_XPBoosts from './en-US/stw-operations/xpboosts.json'
import enUS_stwOperations_Llamas from './en-US/stw-operations/llamas.json'
import enUS_accountManagement_VBucksInformation from './en-US/account-management/vbucks-information.json'
import enUS_accountManagement_EULA from './en-US/account-management/eula.json'
import enUS_accountManagement_RedeemCodes from './en-US/account-management/redeem-codes.json'
import enUS_accountManagement_DevicesAuth from './en-US/account-management/devices-auth.json'
import enUS_accountManagement_EpicSettings from './en-US/account-management/epic-settings.json'
import enUS_advancedMode_MatchmakingTrack from './en-US/advanced-mode/matchmaking-track.json'
import enUS_advancedMode_WorldInfo from './en-US/advanced-mode/world-info.json'
import enUS_myAccounts_General from './en-US/accounts/general.json'
import enUS_myAccounts_AuthCode from './en-US/accounts/auth-code.json'
import enUS_myAccounts_ExchangeCode from './en-US/accounts/exchange-code.json'
import enUS_myAccounts_DeviceAuth from './en-US/accounts/device-auth.json'
import enUS_myAccounts_RemoveAccount from './en-US/accounts/remove-account.json'

const enUS = {
  sidebar: enUS_sidebar,
  general: enUS_general,
  history: enUS_history,
  settings: enUS_settings,
  alerts: enUS_alerts,
  zones: enUS_zones,
  'stw-operations': {
    'auto-kick': enUS_stwOperations_AutoKick,
    'taxi-service': enUS_stwOperations_TaxiService,
    'daily-quests': enUS_stwOperations_DailyQuests,
    party: enUS_stwOperations_Party,
    urns: enUS_stwOperations_Urns,
    xpboosts: enUS_stwOperations_XPBoosts,
    llamas: enUS_stwOperations_Llamas,
  },
  'account-management': {
    'vbucks-information': enUS_accountManagement_VBucksInformation,
    'redeem-codes': enUS_accountManagement_RedeemCodes,
    'devices-auth': enUS_accountManagement_DevicesAuth,
    'epic-settings': enUS_accountManagement_EpicSettings,
    eula: enUS_accountManagement_EULA,
  },
  'advanced-mode': {
    'matchmaking-track': enUS_advancedMode_MatchmakingTrack,
    'world-info': enUS_advancedMode_WorldInfo,
  },
  accounts: {
    general: enUS_myAccounts_General,
    'auth-code': enUS_myAccounts_AuthCode,
    'exchange-code': enUS_myAccounts_ExchangeCode,
    'device-auth': enUS_myAccounts_DeviceAuth,
    'remove-account': enUS_myAccounts_RemoveAccount,
  },
}

export enum Language {
  English = 'en-US',
}

export const resources: Resource = {
  [Language.English]: enUS,
}
