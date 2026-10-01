import { createRoute, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Route as RootRoute } from '../../__root'

import { HomeBreadcrumb } from '../../../components/navigations/breadcrumb/home'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../../components/ui/breadcrumb'
// import { Button } from '../../../components/ui/button'

import { ClaimRewardsCard } from './-claim-rewards'
import { InviteCard } from './-invite'
import { LeavePartyCard } from './-leave-party'

import { useClaimedRewardsNotifications } from './-hooks'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/stw-operations/party',
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  useClaimedRewardsNotifications()

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <HomeBreadcrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('stw-operations.title')}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {t('stw-operations.options.party')}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-grow">
        <div className="flex items-center justify-center w-full">
          <div className="flex flex-col items-center space-y-5 w-full">
            <div className="flex gap-5 items-center justify-center">
              <ClaimRewardsCard />
              <LeavePartyCard />
            </div>

            <InviteCard />
          </div>
        </div>
      </div>
    </>
  )
}



