import { useTranslation } from 'react-i18next'
import { useEffect } from 'react'

import { Language } from '../../locales/resources'

import { useLanguage } from '../../hooks/language'

import { useCustomizableMenuSettingsStore } from '../../state/settings/customizable-menu'
import {
  useDevSettingsStore,
  useSettingsStore,
} from '../../state/settings/main'

import { changeDateLocale } from '../../lib/dates'

export function LoadSettings() {
  const { i18n } = useTranslation()

  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const updateCustomProcessStatus = useSettingsStore(
    (state) => state.updateCustomProcessStatus
  )
  const updateDevSettings = useDevSettingsStore(
    (state) => state.updateDevSettings
  )
  const syncMenuOptions = useCustomizableMenuSettingsStore(
    (state) => state.syncMenuOptions
  )
  const { updateLanguage } = useLanguage()

  // English only: no language picker, a fresh install is saved as English.
  useEffect(() => {
    const listener = window.electronAPI.appLanguageNotification(
      async (data) => {
        if (!data.generatedFile || data.language !== Language.English) {
          window.electronAPI.changeAppLanguage(Language.English)
        }

        updateLanguage(Language.English)
        i18n.changeLanguage(Language.English)
        changeDateLocale(Language.English)
      }
    )

    window.electronAPI.requestAppLanguage()

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.responseSettings(
      async (settings) => {
        updateSettings(settings)
      }
    )

    window.electronAPI.requestSettings()

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationDevSettings(
      async (settings) => {
        updateDevSettings(settings)
      }
    )

    window.electronAPI.requestDevSettings()

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationCustomizableMenuData(
      async (data) => {
        syncMenuOptions(data)
      }
    )

    window.electronAPI.requestCustomizableMenuData()

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationCustomProcessStatus(
      async (isRunning) => {
        updateCustomProcessStatus(isRunning)
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  return null
}
