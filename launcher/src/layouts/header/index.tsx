import { Link } from '@tanstack/react-router'
import {
  Eye,
  EyeOff,
  History,
  Menu,
  Minus,
  Download,
  Palette,
  Rocket,
  Settings,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '../../components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip'

import { AccountList } from '../../components/account-list'
import { HistoryMenu } from '../../components/menu/history'
import { SidebarMenu } from '../../components/menu/sidebar'

import { repositoryReleasesURL } from '../../config/about/links'

import { useCheckNewVersion } from '../../bootstrap/components/hooks'

import { useUISidebarHistory } from '../../hooks/ui/sidebars'
import { useAttributesStates, useHandlers, useWindowEvents } from './hooks'

import { whatIsThis } from '../../lib/callbacks'
import {
  areAccountNamesHidden,
  setAccountNamesHidden,
} from '../../lib/privacy'
import {
  applyBackgroundTheme,
  backgroundThemes,
  getSavedThemeId,
} from '../../lib/themes'
import { cn } from '../../lib/utils'

export function Header() {
  const { t } = useTranslation(['general'])

  const { customProcessIsRunning, isButtonDisabled, open, setOpen } =
    useAttributesStates()
  const {
    handleCloseWindow,
    handleKillProcess,
    handleLaunch,
    handleMinimizeWindow,
  } = useHandlers()
  const { isMinWith } = useWindowEvents()

  return (
    <>
      <header className="flex h-[var(--header-height)] items-center px-1.5 relative border-b border-border/20 bg-black/30 backdrop-blur-md">
        <div className="app-draggable-region absolute h-full left-0 top-0 w-full -z-10" />

        <div className="flex gap-1.5 relative w-full z-10">
          <Sheet
            open={open}
            onOpenChange={setOpen}
          >
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="not-draggable-region shrink-0 hidden"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              className="flex flex-col p-0"
              side="left"
              hideCloseButton
            >
              <div>
                <div className="app-draggable-region flex h-[var(--header-height)] items-center justify-center text-center-">
                  <SheetClose className="not-draggable-region">
                    <X />
                    <span className="sr-only">close navigation menu</span>
                  </SheetClose>
                </div>
                <SidebarMenu onOpenChange={setOpen} />
              </div>
            </SheetContent>
          </Sheet>

          <AccountList />

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={cn(
                    'leading-4 not-draggable-region px-2 py-1',
                    {
                      'w-[7.5rem]': !isMinWith,
                    },
                  )}
                  size={isMinWith ? 'icon' : 'default'}
                  variant={
                    customProcessIsRunning ? 'secondary' : 'outline'
                  }
                  disabled={isButtonDisabled}
                  onClick={handleLaunch}
                >
                  {isMinWith ? (
                    <Rocket size={20} />
                  ) : (
                    <span className="text-balance truncate">
                      {t('launch-game.button')}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                className={cn({
                  hidden: !customProcessIsRunning,
                })}
              >
                <p>{t('is-running')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={cn(
                    'leading-4 not-draggable-region px-2 py-1',
                    {
                      'w-[7.5rem]': !isMinWith,
                    },
                  )}
                  size={isMinWith ? 'icon' : 'default'}
                  variant={
                    customProcessIsRunning ? 'default' : 'secondary'
                  }
                  disabled={isButtonDisabled}
                  onClick={handleKillProcess}
                >
                  {isMinWith ? (
                    <X size={20} />
                  ) : (
                    <span className="text-balance truncate">
                      {t('close-game.button')}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                className={cn({
                  hidden: customProcessIsRunning,
                })}
              >
                <p>{t('is-not-running')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            className="not-draggable-region"
            size="icon"
            variant="ghost"
            onAuxClick={whatIsThis()}
            asChild
          >
            <Link to="/settings">
              <Settings />
              <span className="sr-only">go to settings</span>
            </Link>
          </Button>

          <HistorySheet />

          <ThemesMenu />

          <HideNamesButton />

          {/* Centred in the free space between the left buttons and the
              window controls. */}
          <div className="flex flex-1 items-center justify-center min-w-0">
            <UpdatesButton compact={isMinWith} />
          </div>

          <div className="flex items-center">
            <Button
              className="not-draggable-region"
              size="icon"
              variant="ghost"
              onClick={handleMinimizeWindow}
            >
              <Minus />
              <span className="sr-only">minimize application</span>
            </Button>
            <Button
              className="not-draggable-region"
              size="icon"
              variant="ghost"
              onClick={handleCloseWindow}
            >
              <X />
              <span className="sr-only">close application</span>
            </Button>
          </div>
        </div>
      </header>
    </>
  )
}

function UpdatesButton({ compact }: { compact: boolean }) {
  // Set when GitHub has a newer release than this build (checked on start
  // and every few hours, see Application.checkVersion).
  const { data: update } = useCheckNewVersion()

  const handleOpen = () => {
    window.electronAPI.openExternalURL(
      update?.link ?? `${repositoryReleasesURL}/latest`,
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className={cn('gap-2 not-draggable-region', {
              'bg-emerald-500/10 ring-1 ring-emerald-400/40 hover:bg-emerald-500/20':
                update,
            })}
            size="sm"
            variant="ghost"
            onClick={handleOpen}
          >
            {/* A download icon: the old circular arrows looked like reload. */}
            <Download size={18} />
            {update
              ? compact
                ? 'Update'
                : 'Update available'
              : compact
                ? 'Updates'
                : 'Check for updates'}
            {update && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        {/* Below the button: above it clipped into the window's top edge. */}
        <TooltipContent side="bottom">
          <p>
            {update
              ? 'A new version is out. Click to download it.'
              : 'Opens the latest release on GitHub'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function HideNamesButton() {
  const hidden = areAccountNamesHidden()

  // Names are read in a lot of places, a reload is the simplest way to
  // update all of them at once.
  const handleToggle = () => {
    setAccountNamesHidden(!hidden)
    window.location.reload()
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="not-draggable-region"
            size="icon"
            variant="ghost"
            onClick={handleToggle}
          >
            {hidden ? <EyeOff /> : <Eye />}
            <span className="sr-only">toggle account names</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{hidden ? 'Show account names' : 'Hide account names'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ThemesMenu() {
  const [current, setCurrent] = useState(getSavedThemeId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="not-draggable-region"
          size="icon"
          variant="ghost"
        >
          <Palette />
          <span className="sr-only">change background theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Themes</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(id) => setCurrent(applyBackgroundTheme(id))}
        >
          {backgroundThemes.map((theme) => (
            <DropdownMenuRadioItem
              key={theme.id}
              value={theme.id}
            >
              {theme.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HistorySheet() {
  const { changeVisibility, visibility } = useUISidebarHistory()

  return (
    <Sheet
      open={visibility}
      onOpenChange={changeVisibility}
    >
      <SheetTrigger asChild>
        <Button
          className="not-draggable-region"
          size="icon"
          variant="ghost"
        >
          <History />
          <span className="sr-only">toggle history sidebar</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex flex-col p-0"
        hideCloseButton
      >
        <HistoryMenu />
      </SheetContent>
    </Sheet>
  )
}
