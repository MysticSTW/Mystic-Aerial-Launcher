import { createTheme, MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/react-router'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import dayjs from 'dayjs'
import { createRoot } from 'react-dom/client'

import { IndexComponent } from './routes'
import { routeTree } from './routeTree.gen'

import { LoadMatchmakingPath } from './bootstrap/components/advanced-mode/load-matchmaking-path'
// import { LoadWorldInfoFiles } from './bootstrap/components/advanced-mode/load-world-info-files'
import {
  LoadHomeWorldInfo,
  LoadWorldInfoData,
} from './bootstrap/components/advanced-mode/load-world-info'
import { LoadAccounts } from './bootstrap/components/load-accounts'
import { LoadAutoLlamas } from './bootstrap/components/load-auto-llamas'
import { LoadAutoPinUrns } from './bootstrap/components/load-auto-pin-urns'
import { LoadAutomation } from './bootstrap/components/load-automation'
import { LoadFriends } from './bootstrap/components/load-friends'
import { LoadGroups } from './bootstrap/components/load-groups'
import { LoadSettings } from './bootstrap/components/load-settings'
import { LoadTags } from './bootstrap/components/load-tags'

import { Toaster } from './components/ui/sonner'
import { ThemeProvider } from './components/theme-provider'

import { applyBackgroundTheme, getSavedThemeId } from './lib/themes'
import { preloadShopExtras } from './routes/-index/-home/todays-llama'

import 'dayjs/locale/es'
import './locale'

applyBackgroundTheme(getSavedThemeId())
preloadShopExtras()

dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)

const root = createRoot(document.getElementById('app')!)
// Hash history keeps the page address on index.html (pages go after "#").
// With normal history the address became e.g. file:///C:/settings, so a
// reload showed "Failed to load application window" and relative file paths
// broke.
const router = createRouter({ routeTree, history: createHashHistory() })

const theme = createTheme({
  /** Put your mantine theme override here */
})

root.render(
  <MantineProvider theme={theme}>
    <ThemeProvider>
      <LoadSettings />
      <LoadTags />
      <LoadGroups />
      <LoadAccounts />
      <LoadFriends />
      <LoadHomeWorldInfo />
      <LoadWorldInfoData />
      {/* <LoadWorldInfoFiles /> */}
      <LoadMatchmakingPath />
      <LoadAutomation />
      <LoadAutoLlamas />
      <LoadAutoPinUrns />

      <RouterProvider
        router={router}
        /**
         * Used when app is packaged (static, default home)
         */
        defaultNotFoundComponent={IndexComponent}
      />

      <Toaster position="bottom-center" />
    </ThemeProvider>
  </MantineProvider>
)

export { router }
