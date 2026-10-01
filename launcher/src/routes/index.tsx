import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'

// import { CheckNewVersion } from '../bootstrap/components/check-new-version'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import { GoToTop } from '../components/go-to-top'
import { AlertsOverview } from './-index/-alerts-overview/-index'
import { FetchAlertsButton } from './-index/-components/-fetch-alerts-button'
import { HomeAlerts } from './-index/-home/-index'
import { AlertsDone } from './-index/alerts-done'
// import { HeaderNavigation } from './-index/-header-navigation'

import { useGetAccounts } from '../hooks/accounts'
import { useDropzoneConfig, useFetchPlayerDataSync } from './-index/-hooks'

import { cn } from '../lib/utils'

enum IndexTabs {
  Home = 'home',
  AlertsOverview = 'alerts-overview',
  AlertsDone = 'alerts-done',
}

const defaultTab = IndexTabs.Home

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

export function IndexComponent() {
  const { t } = useTranslation(['alerts'])

  const { isFileAccepted, isFileRejected, getRootProps } =
    useDropzoneConfig()

  useFetchPlayerDataSync()

  return (
    <div className="relative w-full min-h-screen">
      {/* The weak background blur (body::before) lives in globals.css. */}

      {/* Update banner (links to GitHub releases) is off, uncomment to
          bring it back. */}
      {/* <CheckNewVersion /> */}

      <div className="relative flex flex-grow justify-center items-start bg-transparent py-3 px-2 min-h-[calc(100vh-var(--header-height))]">
        <div
          {...getRootProps({
            className: cn('relative w-full max-w-4xl z-10', {
              '[&_.dzm]:hidden': isFileAccepted,
              '[&_.dzm-not-allowed]:hidden': isFileRejected,
            }),
          })}
        >
          <MainContent />
        </div>
      </div>
    </div>
  )
}

const MainContent = memo(() => {
  const { t } = useTranslation(['alerts'])

  return (
    <>
      <Tabs
        className={cn(
          'mb-5 mt-2',
          '[&_.tab-content]:mt-3'
        )}
        defaultValue={defaultTab}
      >
        <NavigationTab />
        
        <TabsContent
          className="tab-content"
          value={IndexTabs.Home}
        >
          <div className="glass-surface rounded-lg p-6 shadow-xl border border-white/5">
            <HomeAlerts />
          </div>
        </TabsContent>

        <TabsContent
          className="tab-content"
          value={IndexTabs.AlertsOverview}
        >
          <div className="glass-surface rounded-lg p-6 shadow-xl border border-white/5">
            <AlertsOverview />
          </div>
        </TabsContent>

        <TabsContent
          className="tab-content"
          value={IndexTabs.AlertsDone}
        >
          <div className="glass-surface rounded-lg p-6 shadow-xl border border-white/5">
            <AlertsDone />
          </div>
        </TabsContent>
      </Tabs>

      <GoToTop containerId="alert-navigation-container" />
    </>
  )
})

function NavigationTab() {
  const { t } = useTranslation(['alerts'])

  const { accountsArray } = useGetAccounts()

  const alertsDoneTabDisabled = accountsArray.length <= 0

  return (
    <div
      className="flex items-center"
      id="alert-navigation-container"
    >
      <TabsList>
        <TabsTrigger value={IndexTabs.Home}>{t('tabs.home')}</TabsTrigger>
        <TabsTrigger value={IndexTabs.AlertsOverview}>
          {t('tabs.overview')}
        </TabsTrigger>
        <TabsTrigger
          value={IndexTabs.AlertsDone}
          disabled={alertsDoneTabDisabled}
        >
          {t('tabs.done')}
        </TabsTrigger>
      </TabsList>
      <FetchAlertsButton />
    </div>
  )
}