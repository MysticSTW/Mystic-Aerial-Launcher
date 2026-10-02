import type { MouseEventHandler, PropsWithChildren } from 'react'

import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { forwardRef } from 'react'

import packageJson from '../../../package.json'

import { AutomationStatusType } from '../../config/constants/automation'

import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'

import { useGetAutomationDataStatus } from '../../hooks/stw-operations/automation'
import { useGetTaxiServiceDataStatus } from '../../hooks/stw-operations/taxi-service'
import { useCustomizableMenuSettingsVisibility } from '../../hooks/settings'

import { useAccountListStore } from '../../state/accounts/list'
import { useAutoLlamaStore } from '../../state/stw-operations/auto/llamas'
import { useAutoPinUrnDataStore } from '../../state/stw-operations/urns'

import { numberWithCommaSeparator } from '../../lib/parsers/numbers'
import { cn } from '../../lib/utils'
import { whatIsThis } from '../../lib/callbacks'

const currentClassNameHover =
  'hover:opacity-75 dark:opacity-100 dark:hover:text-white'
const activeClassName = 'opacity-75 dark:text-white'

export function SidebarMenu({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation(['sidebar'])

  const accounts = useAccountListStore((state) => state.accounts)
  const { status } = useGetAutomationDataStatus()
  const { status: tsStatus } = useGetTaxiServiceDataStatus()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  // Active when any toggle is on for an account that is still added.
  const autoLlamasActive = useAutoLlamaStore((state) =>
    Object.values(state.accounts).some(
      (item) =>
        accounts[item.accountId] !== undefined &&
        Object.values(item.actions).some(Boolean),
    ),
  )
  const urnsActive = useAutoPinUrnDataStore((state) =>
    [state.data, state.miniBosses].some((list) =>
      Object.entries(list).some(
        ([accountId, enabled]) => enabled && accounts[accountId] !== undefined,
      ),
    ),
  )

  const total = Object.keys(accounts).length
  const areThereAccounts = total > 0
  const totalInText = numberWithCommaSeparator(total)

  const goToPage = () => {
    onOpenChange?.(false)
  }

  return (
    <ScrollArea className="h-full max-h-[calc(100vh-var(--header-height))] bg-transparent p-0 m-0 border-none shadow-none">
      <div className="flex-1 flex flex-col justify-between h-full p-0 m-0 border-none shadow-none bg-transparent">
        <nav className="grid items-start p-3 m-0 text-sm font-medium select-none bg-transparent border-none shadow-none">
          {getMenuOptionVisibility('currentAlerts') && (
            <Link
              to="/"
              className={cn(
                'pl-3 py-2 text-muted-foreground',
                currentClassNameHover,
              )}
              activeProps={{
                className: cn(activeClassName),
              }}
            >
              {t('general:go-to-current-alerts')}
            </Link>
          )}

          {/* STW Operations */}
          {getMenuOptionVisibility('stwOperations', true) && (
            <>
              <Title className="mt-4 pb-0">{t('stw-operations.title')}</Title>
              <div
                className={cn(
                  'text-muted-foreground bg-transparent border-none shadow-none p-0 m-0',
                  '[&_.item>a]:flex',
                )}
              >
                <ul className="list-disc ml-5 space-y-1">
                  {getMenuOptionVisibility('autoKick') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/automation"
                        className={cn(currentClassNameHover)}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        <span className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                          {t('stw-operations.options.auto-kick')}
                          {status !== null && (
                            <StatusBadge
                              issue={status === AutomationStatusType.ISSUE}
                            />
                          )}
                        </span>
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('taxiService') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/taxi-service"
                        className={cn(currentClassNameHover)}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        <span className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                          {t('stw-operations.options.taxi-service')}
                          {tsStatus !== null && (
                            <StatusBadge
                              issue={tsStatus === AutomationStatusType.ISSUE}
                            />
                          )}
                        </span>
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('party') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/party"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('stw-operations.options.party')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('dailyQuests') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/daily-quests"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('stw-operations.options.daily-quests')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('xpBoosts') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/xpboosts"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('stw-operations.options.xp-boosts')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('autoPinUrns') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/urns"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        <span className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                          {t('stw-operations.options.auto-pin-urns')}
                          {urnsActive && <StatusBadge />}
                        </span>
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('autoLlamas') && (
                    <li className="item">
                      <Link
                        to="/stw-operations/auto-llamas"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        <span className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                          {t('stw-operations.options.auto-llamas')}
                          {autoLlamasActive && <StatusBadge />}
                        </span>
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
              <Separator className="my-4 mx-3 opacity-20" />
            </>
          )}

          {/* Account Management */}
          {getMenuOptionVisibility('accountManagement', true) && (
            <>
              <Title className="pb-0">
                {t('account-management.title')}
              </Title>
              <div
                className={cn(
                  'text-muted-foreground bg-transparent border-none shadow-none p-0 m-0',
                  '[&_.item>a]:flex',
                )}
              >
                <ul className="list-disc ml-5 space-y-1">
                  {getMenuOptionVisibility('vbucksInformation') && (
                    <li className="item">
                      <Link
                        to="/account-management/vbucks-information"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('account-management.options.vbucks-information')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('redeemCodes') && (
                    <li className="item">
                      <Link
                        to="/account-management/redeem-codes"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('account-management.options.redeem-codes')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('devicesAuth') && (
                    <li className="item">
                      <Link
                        to="/account-management/devices-auth"
                        className={cn({
                          [currentClassNameHover]: areThereAccounts,
                          'cursor-not-allowed opacity-60': !areThereAccounts,
                        })}
                        activeProps={{
                          className: cn({ [activeClassName]: areThereAccounts }),
                        }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                        disabled={!areThereAccounts}
                      >
                        {t('account-management.options.devices-auth')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('epicGamesSettings') && (
                    <li className="item">
                      <Link
                        to="/account-management/epic-games-settings"
                        className={cn({
                          [currentClassNameHover]: areThereAccounts,
                          'cursor-not-allowed opacity-60': !areThereAccounts,
                        })}
                        activeProps={{
                          className: cn({ [activeClassName]: areThereAccounts }),
                        }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                        disabled={!areThereAccounts}
                      >
                        {t('account-management.options.epic-settings')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('eula') && (
                    <li className="item">
                      <Link
                        to="/account-management/eula"
                        className={cn({
                          [currentClassNameHover]: areThereAccounts,
                          'cursor-not-allowed opacity-60': !areThereAccounts,
                        })}
                        activeProps={{
                          className: cn({ [activeClassName]: areThereAccounts }),
                        }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                        disabled={!areThereAccounts}
                      >
                        EULA
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
              <Separator className="my-4 mx-3 opacity-20" />
            </>
          )}

          {/* Advanced Mode */}
          {getMenuOptionVisibility('advancedMode', true) && (
            <>
              <Title className="pb-0">{t('advanced-mode.title')}</Title>
              <div
                className={cn(
                  'text-muted-foreground bg-transparent border-none shadow-none p-0 m-0',
                  '[&_.item>a]:flex',
                )}
              >
                <ul className="list-disc ml-5 space-y-1">
                  {getMenuOptionVisibility('matchmakingTrack') && (
                    <li className="item">
                      <Link
                        to="/advanced-mode/matchmaking-track"
                        className={cn({
                          [currentClassNameHover]: areThereAccounts,
                          'cursor-not-allowed opacity-60': !areThereAccounts,
                        })}
                        activeProps={{
                          className: cn({ [activeClassName]: areThereAccounts }),
                        }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                        disabled={!areThereAccounts}
                      >
                        {t('advanced-mode.options.matchmaking-track')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('worldInfo') && (
                    <li className="item">
                      <Link
                        to="/advanced-mode/world-info"
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('advanced-mode.options.world-info')}
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
              <Separator className="my-4 mx-3 opacity-20" />
            </>
          )}

          {/* My Accounts */}
          {getMenuOptionVisibility('myAccounts', true) && (
            <>
              <Title className="pb-0">
                {t('accounts.title')}
                {getMenuOptionVisibility('showTotalAccounts') &&
                totalInText !== '0'
                  ? ` (${totalInText})`
                  : ''}
              </Title>
              <div
                className={cn(
                  'text-muted-foreground bg-transparent border-none shadow-none p-0 m-0',
                  '[&_.item>a]:flex',
                )}
              >
                <ul className="list-disc ml-5 space-y-1">
                  {getMenuOptionVisibility('authorizationCode') && (
                    <li className="item">
                      <Link
                        to="/accounts/add/$type"
                        params={{ type: 'authorization-code' }}
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('accounts.options.auth')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('exchangeCode') && (
                    <li className="item">
                      <Link
                        to="/accounts/add/$type"
                        params={{ type: 'exchange-code' }}
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('accounts.options.exchange')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('deviceAuth') && (
                    <li className="item">
                      <Link
                        to="/accounts/add/$type"
                        params={{ type: 'device-auth' }}
                        className={currentClassNameHover}
                        activeProps={{ className: cn(activeClassName) }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                      >
                        {t('accounts.options.device')}
                      </Link>
                    </li>
                  )}
                  {getMenuOptionVisibility('removeAccount') && (
                    <li className="item">
                      <Link
                        to="/accounts/remove"
                        className={cn({
                          [currentClassNameHover]: areThereAccounts,
                          'cursor-not-allowed opacity-60': !areThereAccounts,
                        })}
                        activeProps={{
                          className: cn({ [activeClassName]: areThereAccounts }),
                        }}
                        onClick={goToPage}
                        onAuxClick={whatIsThis()}
                        disabled={!areThereAccounts}
                      >
                        {t('accounts.options.remove')}
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </nav>

        <div className="mt-auto pt-4 text-xs text-muted-foreground text-center select-none opacity-80">
          {/* The GitHub release number (package.json "version" is only the
              Windows installer number). */}
          Version {packageJson.releaseVersion}
        </div>
      </div>
    </ScrollArea>
  )
}

// FIX: added displayName so React DevTools labels this correctly
const Title = forwardRef<
  HTMLDivElement,
  PropsWithChildren<{ className?: string }>
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-wrap items-center bg-transparent p-0 px-3 m-0 border-none shadow-none rounded-none',
        'font-bold text-white uppercase text-[10px] tracking-widest',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})
Title.displayName = 'Title'

/**
 * The green ACTIVE (or yellow ISSUE) badge next to a menu option. Shared so
 * every badge is the same size: building the classes by hand once left out
 * a class the others lost through cn() and made one badge shorter.
 */
function StatusBadge({ issue = false }: { issue?: boolean }) {
  const { t } = useTranslation(['sidebar'])

  return (
    <span
      className={cn(
        'border flex font-bold items-center px-2 rounded text-[0.65rem] uppercase',
        issue
          ? 'border-yellow-600 text-yellow-600'
          : 'border-green-600 text-green-600',
      )}
    >
      {issue
        ? t('stw-operations.auto-kick-status.issue')
        : t('stw-operations.auto-kick-status.active')}
    </span>
  )
}
