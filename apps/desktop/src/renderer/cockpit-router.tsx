import type { ReactNode } from 'react'
import { createHashRouter, Navigate, Outlet, useMatches } from 'react-router'
import { AtlasSidebar } from '@/domains/atlas/renderer/components/atlas-sidebar'
import { AtlasPage } from '@/domains/atlas/renderer/pages/atlas-page'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { useProjects } from '@/domains/projects/renderer/port'
import { EmptyProjectScreen } from '@/domains/projects/renderer/screens/empty-project-screen'
import { ProjectSetupWindow } from '@/domains/projects/renderer/setup/project-setup-window'
import { DevelopmentIdentityBar } from '@/domains/sessions/renderer/composer/development-identity-bar'
import { SessionsPage } from '@/domains/sessions/renderer/pages/sessions-page'
import { SessionsSidebar } from '@/domains/sessions/renderer/roster/sessions-sidebar'
import { SessionScreenView } from '@/domains/sessions/renderer/screens/session-screen-view'
import { TicketsPage } from '@/domains/tickets/renderer/pages/tickets-page'
import { TicketsScreenView } from '@/domains/tickets/renderer/screens/tickets-screen-view'
import { TicketsSidebar } from '@/domains/tickets/renderer/sidebar/tickets-sidebar'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'
import { DESTINATION_PATHS, DESTINATIONS, navigateCommand } from '@/platform/shared/commands'

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

export function CockpitRouteLayout() {
  const [cockpit] = useProjects()
  useCommands((command) => {
    const destination = DESTINATIONS.find((item) => navigateCommand(item) === command)
    if (destination) window.location.hash = DESTINATION_PATHS[destination]
  })
  const sidebar = useMatches().reduce<ReactNode | null>(
    (currentSidebar, match) =>
      isCockpitRouteHandle(match.handle) ? match.handle.sidebar : currentSidebar,
    null,
  )

  if (cockpit.status === 'empty') return <EmptyProjectScreen />
  if (cockpit.status === 'setup' && cockpit.project) {
    return <ProjectSetupWindow project={cockpit.project} />
  }
  return (
    <CockpitShell
      footer={<DevelopmentIdentityBar identity={window.argo?.development ?? null} ticket={null} />}
      header={<ProjectSwitcher />}
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
