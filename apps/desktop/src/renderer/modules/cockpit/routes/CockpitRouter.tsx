import type { ReactNode } from 'react'
import { createHashRouter, Navigate, Outlet, useMatches } from 'react-router'

import { DESTINATION_PATHS, DESTINATIONS, navigateCommand } from '@/core/commands/shortcuts'

import { AtlasSidebar } from '../../atlas/components/AtlasSidebar'
import { AtlasPage } from '../../atlas/pages/AtlasPage'
import { SessionsSidebar } from '../../sessions/components/SessionsSidebar'
import { SessionsPage } from '../../sessions/pages/SessionsPage'
import { SessionScreenView } from '../../sessions/screens/SessionScreenView'
import { TicketsSidebar } from '../../tickets/components/TicketsSidebar'
import { TicketsPage } from '../../tickets/pages/TicketsPage'
import { CockpitShell } from '../components/CockpitShell'
import { ProjectSwitcher } from '../components/ProjectSwitcher'
import { useCommands } from '../hooks/useCommands'

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
    <CockpitShell header={<ProjectSwitcher />} sidebar={sidebar}>
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
      },
      {
        path: '/atlas',
        handle: { sidebar: sidebarByPage.atlas } satisfies CockpitRouteHandle,
        element: <AtlasPage />,
      },
    ],
  },
])
