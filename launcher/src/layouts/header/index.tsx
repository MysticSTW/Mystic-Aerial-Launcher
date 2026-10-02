import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  Check,
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
  DropdownMenuItem,
  DropdownMenuLabel,
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
  TooltipPortal,
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

          <HeaderTooltip
            label={t('is-running')}
            hidden={!customProcessIsRunning}
          >
            <Button
              className={cn('leading-4 not-draggable-region px-2 py-1', {
                'w-[7.5rem]': !isMinWith,
              })}
              size={isMinWith ? 'icon' : 'default'}
              variant={customProcessIsRunning ? 'secondary' : 'outline'}
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
          </HeaderTooltip>

          <HeaderTooltip
            label={t('is-not-running')}
            hidden={customProcessIsRunning}
          >
            <Button
              className={cn('leading-4 not-draggable-region px-2 py-1', {
                'w-[7.5rem]': !isMinWith,
              })}
              size={isMinWith ? 'icon' : 'default'}
              variant={customProcessIsRunning ? 'default' : 'secondary'}
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
          </HeaderTooltip>

          <HeaderTooltip label="Settings">
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
          </HeaderTooltip>

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
    <HeaderTooltip
      label={
        update
          ? 'A new version is out. Click to download it.'
          : 'Opens the latest release on GitHub'
      }
    >
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
    </HeaderTooltip>
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
    <HeaderTooltip
      label={hidden ? 'Show account names' : 'Hide account names'}
    >
      <Button
        className="not-draggable-region"
        size="icon"
        variant="ghost"
        onClick={handleToggle}
      >
        {hidden ? <EyeOff /> : <Eye />}
        <span className="sr-only">toggle account names</span>
      </Button>
    </HeaderTooltip>
  )
}

function ThemesMenu() {
  const [current, setCurrent] = useState(getSavedThemeId)

  return (
    <DropdownMenu>
      <HeaderTooltip label="Themes">
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
      </HeaderTooltip>
      <DropdownMenuContent
        align="start"
        className="w-72 p-2"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel className="flex items-center gap-2 px-1 pb-2 pt-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Palette size={14} />
          Background theme
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-2">
          {backgroundThemes.map((theme) => {
            const selected = theme.id === current

            return (
              <DropdownMenuItem
                className={cn(
                  'group flex-col items-stretch gap-1.5 rounded-lg p-1.5 ring-1 ring-white/10 focus:bg-white/[0.08]',
                  {
                    'bg-white/[0.06] ring-white/60': selected,
                  },
                )}
                onSelect={() => setCurrent(applyBackgroundTheme(theme.id))}
                key={theme.id}
              >
                <div className="relative h-16 overflow-hidden rounded-md bg-black/40">
                  {theme.url ? (
                    <img
                      className="size-full object-cover transition-transform duration-300 group-focus:scale-105"
                      src={theme.url}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center rounded-md border border-dashed border-white/20 text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                  {selected && (
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white text-black shadow">
                      <Check
                        size={13}
                        strokeWidth={3}
                      />
                    </span>
                  )}
                </div>
                <span className="truncate px-0.5 text-xs font-medium">
                  {theme.name}
                </span>
              </DropdownMenuItem>
            )
          })}
        </div>
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
      <HeaderTooltip label="History">
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
      </HeaderTooltip>
      <SheetContent
        className="flex flex-col p-0"
        hideCloseButton
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <HistoryMenu />
      </SheetContent>
    </Sheet>
  )
}

/**
 * A tooltip for the header buttons that only opens on hover. Radix also
 * opens tooltips on focus, so after a click (closing a menu, or coming back
 * to the window) the focused button showed its tooltip again and it stayed
 * stuck open until you clicked somewhere else.
 */
function HeaderTooltip({
  children,
  hidden = false,
  label,
}: {
  children: ReactNode
  hidden?: boolean
  label: string
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={hidden ? false : undefined}>
        {/* preventDefault skips Radix's own focus handler, hover still works. */}
        <TooltipTrigger
          onFocus={(event) => event.preventDefault()}
          asChild
        >
          {children}
        </TooltipTrigger>
        {/* Below the button: above it clips into the window's top edge.
            pointer-events-none: the tooltip slides in over the bottom of
            the button, which counted as leaving it and made it blink.
            Portal: inside the header it went under the page menus. */}
        <TooltipPortal>
          <TooltipContent
            className="pointer-events-none"
            side="bottom"
          >
            <p>{label}</p>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  )
}
