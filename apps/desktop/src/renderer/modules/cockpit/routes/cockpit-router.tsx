import type { ReactNode } from 'react'
import { createHashRouter, Navigate, Outlet, useMatches } from 'react-router'

import { DESTINATION_PATHS, DESTINATIONS, navigateCommand } from '@/core/commands/shortcuts'

import { AtlasSidebar } from '../../atlas/components/atlas-sidebar'
import { AtlasPage } from '../../atlas/pages/atlas-page'
import { SessionsSidebar } from '../../sessions/components/roster/sessions-sidebar'
import { SessionsPage } from '../../sessions/pages/sessions-page'
import { DevelopmentIdentityBar } from '../../sessions/components/composer/development-identity-bar'
import { SessionScreenView } from '../../sessions/screens/session-screen-view'
import { TicketsSidebar } from '../../tickets/components/tickets-sidebar'
import { TicketsPage } from '../../tickets/pages/tickets-page'
import { TicketsScreenView } from '../../tickets/screens/tickets-screen-view'
import { CockpitShell } from '../components/cockpit-shell'
import { ProjectSwitcher } from '../components/project-switcher'
import { useCommands } from '../hooks/use-commands'

type CockpitRouteHandle = {
  sidebar: ReactNode
}

const sidebarByPage = {
  atlas: <AtlasSidebar />,
  sessions: <SessionsSidebar />,
  tickets: <TicketsSidebar />,
} as const

function isCockpitRouteHandle(handle: unknown): handle is CockpitRouteHandle {
  return typeof handle === 'object' && handle !== null && 'sidebar' in handle
}

function CockpitRouteLayout() {
  useCommands((command) => {
    const destination = DESTINATIONS.find((item) => navigateCommand(item) === command)
    if (destination) window.location.hash = DESTINATION_PATHS[destination]
  })
  const sidebar = useMatches().reduce<ReactNode | null>(
    (currentSidebar, match) =>
      isCockpitRouteHandle(match.handle) ? match.handle.sidebar : currentSidebar,
    null,
  )

  return (
    <CockpitShell
      header={
        <div className="flex min-w-0 items-center gap-(--spacing-shell-item)">
          <DevelopmentIdentityBar identity={window.argo?.development ?? null} ticket={null} />
          <ProjectSwitcher />
        </div>
      }
      sidebar={sidebar}
    >
      <Outlet />
    </CockpitShell>
  )
}

export const cockpitRouter = createHashRouter([
  {
    element: <CockpitRouteLayout />,
    children: [
      { index: true, element: <Navigate replace to="/sessions" /> },
      {
        path: '/sessions',
        handle: { sidebar: sidebarByPage.sessions } satisfies CockpitRouteHandle,
        element: <SessionsPage />,
        children: [
          { index: true, element: <SessionScreenView /> },
          { path: ':sessionId', element: <SessionScreenView /> },
        ],
      },
      {
        path: '/tickets',
        handle: { sidebar: sidebarByPage.tickets } satisfies CockpitRouteHandle,
        element: <TicketsPage />,
        children: [
          { index: true, element: <TicketsScreenView /> },
          { path: ':ticketKey', element: <TicketsScreenView /> },
        ],
      },
      {
        path: '/atlas',
        handle: { sidebar: sidebarByPage.atlas } satisfies CockpitRouteHandle,
        element: <AtlasPage />,
      },
    ],
  },
])
