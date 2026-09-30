import type { ReactNode } from 'react'
import {
  createHashRouter,
  Navigate,
  Outlet,
  type RouteObject,
  useLocation,
  useMatches,
} from 'react-router'
import { AtlasSidebar } from '@/domains/atlas/renderer/components'
import { AtlasPage } from '@/domains/atlas/renderer/pages'
import { useHarnessReadiness } from '@/domains/harness-signin/renderer/hooks'
import { NoHarnessReadyScreen } from '@/domains/harness-signin/renderer/screens'
import { ProjectSwitcher } from '@/domains/projects/renderer/components'
import { useProjects } from '@/domains/projects/renderer/hooks'
import { EmptyProjectScreen } from '@/domains/projects/renderer/screens'
import { DevelopmentIdentityBar } from '@/domains/sessions/renderer/composer'
import { SessionsPage } from '@/domains/sessions/renderer/pages'
import { SessionScreenView } from '@/domains/sessions/renderer/screens'
import { SessionList } from '@/domains/sessions/renderer/session-list'
import { TicketsPage } from '@/domains/tickets/renderer/pages'
import { TicketsScreenView } from '@/domains/tickets/renderer/screens'
import { TicketsSidebar } from '@/domains/tickets/renderer/sidebar'
import { DESTINATION_PATHS, DESTINATIONS, navigateCommand } from '@/platform/contract/commands'
import { AppShell } from '@/platform/renderer/app/components/app-shell'
import { useCommands } from '@/platform/renderer/cockpit/hooks/use-commands'

type CockpitRouteHandle = {
  sidebar: ReactNode
}

const sidebarByPage = {
  atlas: <AtlasSidebar />,
  sessions: <SessionList />,
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
  const section = matches.find((match) => isCockpitRouteHandle(match.handle))

  if (cockpit.status === 'empty') return <EmptyProjectScreen />
  // Saved Sessions remain readable without a Harness. Other surfaces keep the sign-in gate.
  const opensSavedSessions =
    location.pathname === '/projects' || location.pathname.includes('/sessions')
  if (
    !opensSavedSessions &&
    readiness.data &&
    !readiness.data.some((harness) => harness.state === 'ready')
  ) {
    return <NoHarnessReadyScreen harnesses={readiness.data} />
  }
  return (
    <AppShell
      footer={<DevelopmentIdentityBar identity={window.argo?.development ?? null} ticket={null} />}
      leftHeader={<ProjectSwitcher />}
      sidebar={sidebar}
    >
      {/* Keyed by section, not path: a section switch draws a fresh screen, a Session switch keeps it. */}
      <Outlet key={section?.pathname ?? location.pathname} />
    </AppShell>
  )
}

export const cockpitRoutes: RouteObject[] = [
  {
    element: <CockpitRouteLayout />,
    children: [
      { index: true, element: <Navigate replace to="/projects" /> },
      { path: '/projects', element: <ProjectIndexRedirect /> },
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
]

export const cockpitRouter = createHashRouter(cockpitRoutes)

function ProjectIndexRedirect() {
  const [cockpit] = useProjects()
  return cockpit.project ? (
    <Navigate replace to={`/projects/${cockpit.project.id}/sessions`} />
  ) : null
}
