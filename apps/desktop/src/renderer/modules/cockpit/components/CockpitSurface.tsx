import type { Destination } from '@/core/commands/shortcuts'
import { ProjectDeck } from '@/renderer/modules/projects/components/ProjectDeck'
import { ProjectRefusal } from '@/renderer/modules/projects/components/ProjectRefusal'
import { AppearanceControl } from '../../appearance/components/AppearanceControl'
import type { Cockpit, ProjectActions } from '../../projects/hooks/useProjects'
import { ChromeBar } from './ChromeBar'
import { CockpitShell } from './CockpitShell'
import { NavigationRail } from './NavigationRail'
import { Sidebar } from './Sidebar'

function subject(cockpit: Cockpit): string {
  return cockpit.project ? `— ${cockpit.project.name}` : '— no Project open'
}

type CockpitSurfaceProps = {
  appearance: Parameters<typeof AppearanceControl>[0]['appearance']
  actions: ProjectActions
  chooseAppearance: Parameters<typeof AppearanceControl>[0]['onChange']
  cockpit: Cockpit
  destination: Destination
  navigate: (destination: Destination) => void
}

export function CockpitSurface({
  appearance,
  actions,
  chooseAppearance,
  cockpit,
  destination,
  navigate,
}: CockpitSurfaceProps) {
  const open = cockpit.status === 'selected'
  const sessions = open && destination === 'Sessions'
  const workspaceHeader = cockpitHeader({
    appearance,
    chooseAppearance,
    cockpit,
    destination,
    open,
    sessions,
  })
  return (
    <CockpitShell
      rail={open ? <NavigationRail destination={destination} onNavigate={navigate} /> : undefined}
      roster={
        open && !sessions ? <Sidebar destination={destination} onNavigate={navigate} /> : undefined
      }
      rosterHeader={open && !sessions ? <ChromeBar subject={subject(cockpit)} /> : undefined}
      workspaceHeader={workspaceHeader}
      notice={open && cockpit.message ? <ProjectRefusal message={cockpit.message} /> : undefined}
      deck={
        <ProjectDeck
          actions={actions}
          cockpit={cockpit}
          destination={destination}
          projectName={sessions ? cockpit.project?.name : undefined}
        />
      }
      inspector={open && !sessions ? <SessionInspector /> : undefined}
    />
  )
}

function cockpitHeader({
  appearance,
  chooseAppearance,
  cockpit,
  destination,
  open,
  sessions,
}: Pick<CockpitSurfaceProps, 'appearance' | 'chooseAppearance' | 'cockpit' | 'destination'> & {
  open: boolean
  sessions: boolean
}) {
  if (!open) {
    return (
      <ChromeBar subject={subject(cockpit)}>
        <AppearanceControl appearance={appearance} onChange={chooseAppearance} />
      </ChromeBar>
    )
  }
  return sessions ? undefined : <WorkspaceHeader destination={destination} />
}

function WorkspaceHeader({ destination }: { destination: Destination }) {
  return (
    <header
      className="flex h-(--size-chrome-bar) items-center border-b bg-background px-(--spacing-shell-inset)"
      data-component="WorkspaceHeader"
    >
      <h1 className="text-heading font-medium">{destination}</h1>
    </header>
  )
}

function SessionInspector() {
  return (
    <aside
      aria-label="Session inspector"
      className="flex min-h-0 flex-col border-l bg-card"
      data-component="SessionInspector"
    >
      <header className="flex h-(--size-chrome-bar) items-center border-b px-(--spacing-shell-gutter)">
        <h2 className="text-heading font-medium">Session inspector</h2>
      </header>
      <p className="p-(--spacing-shell-gutter) text-meta text-muted-foreground">
        Select a Session to inspect its activity.
      </p>
    </aside>
  )
}
