import type { ReactNode } from 'react'
import { createHashRouter, Navigate, Outlet, useLocation, useMatches } from 'react-router'
import { AtlasSidebar } from '@/domains/atlas/renderer/components/atlas-sidebar'
import { AtlasPage } from '@/domains/atlas/renderer/pages/atlas-page'
import { useHarnessReadiness } from '@/domains/harness-signin/renderer/hooks/use-harness-readiness'
import { NoHarnessReadyScreen } from '@/domains/harness-signin/renderer/screens/no-harness-ready-screen'
import { ProjectSwitcher } from '@/domains/projects/renderer/components/project-switcher'
import { useProjects } from '@/domains/projects/renderer/hooks/use-projects'
import { EmptyProjectScreen } from '@/domains/projects/renderer/screens/empty-project-screen'
import { ProjectSetupWindow } from '@/domains/projects/renderer/setup/screens/project-setup-window'
import { DevelopmentIdentityBar } from '@/domains/sessions/renderer/composer/identity/development-identity-bar'
import { SessionsPage } from '@/domains/sessions/renderer/pages/sessions-page'
import { SessionScreenView } from '@/domains/sessions/renderer/screens'
import { SessionsSidebar } from '@/domains/sessions/renderer/session-list/sidebar/sessions-sidebar'
import { TicketsPage } from '@/domains/tickets/renderer/pages/tickets-page'
import { TicketsScreenView } from '@/domains/tickets/renderer/screens/tickets-screen-view'
import { TicketsSidebar } from '@/domains/tickets/renderer/sidebar/tickets-sidebar'
import { DESTINATION_PATHS, DESTINATIONS, navigateCommand } from '@/platform/contract/commands'
import { CockpitShell } from '@/platform/renderer/cockpit/components/cockpit-shell'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'

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
  const readiness = useHarnessReadiness()
  const location = useLocation()
  const matches = useMatches()
  useCommands((command) => {
    const destination = DESTINATIONS.find((item) => navigateCommand(item) === command)
    if (destination) {
      const projectId = cockpit.project?.id
      window.location.hash = `/projects/${projectId ?? ''}${DESTINATION_PATHS[destination]}`
    }
  })
  const sidebar = matches.reduce<ReactNode | null>(
    (currentSidebar, match) =>
      isCockpitRouteHandle(match.handle) ? match.handle.sidebar : currentSidebar,
    null,
  )

  if (cockpit.status === 'empty') return <EmptyProjectScreen />
  if (cockpit.status === 'setup' && cockpit.project) {
    return <Navigate replace to={`/projects/${cockpit.project.id}/setup`} />
  }
  // A Project with no Harness signed in has no way to run a Session, so this precedes the
  // roster the same way `EmptyProjectScreen` precedes it for no Project. `readiness.data` is
  // read only once it has landed, so a still-loading first read shows the roster underneath
  // rather than flashing this screen first.
  if (readiness.data && !readiness.data.some((harness) => harness.state === 'ready')) {
    return <NoHarnessReadyScreen harnesses={readiness.data} />
  }
  return (
    <CockpitShell
      footer={<DevelopmentIdentityBar identity={window.argo?.development ?? null} ticket={null} />}
      header={<ProjectSwitcher />}
      sidebar={sidebar}
    >
      <Outlet key={location.pathname} />
    </CockpitShell>
  )
}

export const cockpitRouter = createHashRouter([
  {
    element: <CockpitRouteLayout />,
    children: [
      { index: true, element: <Navigate replace to="/projects" /> },
      { path: '/projects', element: <ProjectIndexRedirect /> },
      {
        id: 'project-setup',
        path: '/projects/:projectId/setup',
        element: <ProjectSetupScreen />,
      },
      {
        path: '/projects/:projectId/sessions',
        handle: { sidebar: sidebarByPage.sessions } satisfies CockpitRouteHandle,
        element: <SessionsPage />,
        children: [
          { index: true, element: <SessionScreenView /> },
          { path: ':sessionId', element: <SessionScreenView /> },
        ],
      },
      {
        path: '/projects/:projectId/tickets',
        handle: { sidebar: sidebarByPage.tickets } satisfies CockpitRouteHandle,
        element: <TicketsPage />,
        children: [
          { index: true, element: <TicketsScreenView /> },
          { path: ':ticketKey', element: <TicketsScreenView /> },
        ],
      },
      {
        path: '/projects/:projectId/atlas',
        handle: { sidebar: sidebarByPage.atlas } satisfies CockpitRouteHandle,
        element: <AtlasPage />,
      },
    ],
  },
])

function ProjectIndexRedirect() {
  const [cockpit] = useProjects()
  return cockpit.project ? (
    <Navigate replace to={`/projects/${cockpit.project.id}/sessions`} />
  ) : null
}

function ProjectSetupScreen() {
  const [cockpit] = useProjects()
  if (!cockpit.project) return <Navigate replace to="/projects" />
  return <ProjectSetupWindow project={cockpit.project} />
}
