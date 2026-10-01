import { createRoute } from '@tanstack/react-router'
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

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/information/credits',
  component: ComponentRoute,
})

export function ComponentRoute() {
  const { t } = useTranslation(['general'])

  return (
    <>
      <Breadcrumb>
        <BreadcrumbList>
          <HomeBreadcrumb />
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t('credits')}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-grow">
        <div className="flex w-full">
          <div className="flex flex-col max-w-md mb-5">
            <h2 className="mb-5 text-3xl">Mystic Launcher</h2>
            <p className="text-muted-foreground">
              Personal launcher for Fortnite Save the World account management.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
