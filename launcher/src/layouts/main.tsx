import type { PropsWithChildren } from 'react'

import { Header } from './header'

import { SidebarMenu } from '../components/menu/sidebar'
import { ScrollArea } from '../components/ui/scroll-area'
// import mysticLogoHeader from '../_assets/mystic-logo-header.png'

// Old sidebar logo, for reference:
// <img src={mysticLogoHeader} alt="Mystic Launcher" style={{ maxHeight: '2.9rem', width: 'auto', objectFit: 'contain' }} draggable={false} />

export function MainLayout({ children }: PropsWithChildren) {
  return (
    // The header spans the full width (over the sidebar too) so the account
    // and game buttons start at the far left.
    <div className="flex flex-col min-h-screen w-full">
      <Header />
      <div className="grid grid-cols-[var(--sidebar-width-md)_1fr] flex-grow">
        <div className="block border-r border-border/20 bg-black/30 backdrop-blur-md">
          <div className="flex h-full max-h-[calc(100vh-var(--header-height))] flex-col">
            <SidebarMenu />
          </div>
        </div>
        <div className="flex flex-col">
          <ScrollArea
            className="h-[calc(100vh-var(--header-height))]"
            viewportClassName="main-wrapper-content"
          >
            <main className="flex flex-col gap-4 h-full min-h-[calc(100vh-var(--header-height))] p-4 relative">
              <div className="absolute inset-0 z-0 pointer-events-none" style={{backdropFilter: 'blur(12px) saturate(1.1)', background: 'rgba(0,0,0,0.15)'}} />
              <div className="relative z-10 flex flex-col gap-4">
                {children}
              </div>
            </main>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
