import { type ReactNode, useMemo } from 'react'
import {
  createHashRouter,
  Outlet,
  type RouteObject,
  replace,
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
import { useCommands } from '@/platform/renderer/shell/hooks/use-commands'
import { queryClient, trpc } from '@/platform/renderer/trpc-client'

type AppRouteHandle = {
  sidebar: ReactNode
}

const projectHeader = <ProjectSwitcher />
const developmentFooter = (
  <DevelopmentIdentityBar identity={window.argo?.development ?? null} ticket={null} />
)

const sidebarByPage = {
  atlas: <AtlasSidebar />,
  sessions: <SessionList />,
  tickets: <TicketsSidebar />,
} as const

// The launch passes through these on its way to a Project's Sessions. A gate drawn on one stops
// or races that redirect, and the redirect then replaces any route set meanwhile (#2996).
const LAUNCH_REDIRECTS = new Set(['/', '/projects'])

function isAppRouteHandle(handle: unknown): handle is AppRouteHandle {
  return typeof handle === 'object' && handle !== null && 'sidebar' in handle
}

export function AppRouteLayout() {
  const [projectState] = useProjects()
  const readiness = useHarnessReadiness()
  const location = useLocation()
  const matches = useMatches()
  useCommands((command) => {
    const destination = DESTINATIONS.find((item) => navigateCommand(item) === command)
    if (destination) {
      const projectId = projectState.project?.id
      window.location.hash = `/projects/${projectId ?? ''}${DESTINATION_PATHS[destination]}`
    }
  })
  const sidebar = matches.reduce<ReactNode | null>(
    (currentSidebar, match) =>
      isAppRouteHandle(match.handle) ? match.handle.sidebar : currentSidebar,
    null,
  )
  const outlet = useMemo(() => <Outlet />, [])

  if (projectState.status === 'empty') return <EmptyProjectScreen />
  // Saved Sessions remain readable without a Harness. Other surfaces keep the sign-in gate.
  const opensSavedSessions = location.pathname.includes('/sessions')
  if (
    !opensSavedSessions &&
    !LAUNCH_REDIRECTS.has(location.pathname) &&
    readiness.data &&
    !readiness.data.some((harness) => harness.state === 'ready')
  ) {
    return <NoHarnessReadyScreen harnesses={readiness.data} />
  }
  return (
    <AppShell footer={developmentFooter} leftHeader={projectHeader} sidebar={sidebar}>
      {outlet}
    </AppShell>
  )
}

export const appRoutes: RouteObject[] = [
  {
    element: <AppRouteLayout />,
    children: [
      { index: true, loader: () => replace('/projects'), HydrateFallback: EmptyOutlet },
      { path: '/projects', loader: firstProjectSessions, HydrateFallback: EmptyOutlet },
      {
        path: '/projects/:projectId/sessions',
        handle: { sidebar: sidebarByPage.sessions } satisfies AppRouteHandle,
        element: <SessionsPage />,
        children: [
          { index: true, element: <SessionScreenView /> },
          { path: ':sessionId', element: <SessionScreenView /> },
        ],
      },
      {
        path: '/projects/:projectId/tickets',
        handle: { sidebar: sidebarByPage.tickets } satisfies AppRouteHandle,
        element: <TicketsPage />,
        children: [
          { index: true, element: <TicketsScreenView /> },
          { path: ':ticketKey', element: <TicketsScreenView /> },
        ],
      },
      {
        path: '/projects/:projectId/atlas',
        handle: { sidebar: sidebarByPage.atlas } satisfies AppRouteHandle,
        element: <AtlasPage />,
      },
    ],
  },
]

export const appRouter = createHashRouter(appRoutes)

// A loader redirect yields to a newer navigation, such as a hash write during the launch.
async function firstProjectSessions() {
  const projects = await queryClient.fetchQuery(trpc.projectList.queryOptions()).catch(() => [])
  return projects[0] ? replace(`/projects/${projects[0].id}/sessions`) : null
}

// The shell draws while the Project list loads, with nothing in its outlet yet.
function EmptyOutlet() {
  return null
}
