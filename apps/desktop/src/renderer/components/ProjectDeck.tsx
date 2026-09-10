// The working surface: the window ground, no edge of its own (ADR-0038).
import type { Destination } from '../../shortcuts'
import type { Cockpit, ProjectActions } from '../hooks/useProjects'
import { EmptyPane, LINE, RefusedPane, SelectedPane, TITLE } from './ProjectPanes'
import { SessionsScreen } from '../modules/sessions/screens/SessionsScreen'

type DeckProps = { destination: Destination; cockpit: Cockpit; actions: ProjectActions }

// The names the design ticket froze, so a state render is found by the name the design shows. A
// turned-away folder is named by the error code rather than by a single spelling for every
// refusal, so `not-a-repository` cannot stand in for a git that will not run. `refused` keeps its
// own name: there the message is about the open Project, not about a folder just chosen.
function stateName({ destination, cockpit }: DeckProps): string {
  if (destination !== 'Projects') return destination.toLowerCase()
  if (cockpit.status === 'refused') return 'refused'
  return cockpit.code ?? cockpit.status
}

function ProjectPane({ cockpit, actions }: { cockpit: Cockpit; actions: ProjectActions }) {
  const { status, project, message, busy } = cockpit
  if (status === 'loading') return null
  if (project && status === 'selected') {
    return (
      <SelectedPane project={project} message={message} actions={{ busy, onOpen: actions.open }} />
    )
  }
  if (project && status === 'refused' && message) {
    return <RefusedPane project={project} message={message} busy={busy} onOpen={actions.open} />
  }
  return <EmptyPane message={message} busy={busy} onOpen={actions.open} />
}

// Every other destination is reachable and says so. Code is a placeholder in this slice and is
// drawn the same way, because a surface that answers nothing still has to answer the click.
function SurfacePane({ destination }: { destination: Destination }) {
  return (
    <>
      <h1 className={TITLE}>{destination}</h1>
      <p className={LINE}>This surface is not built yet.</p>
    </>
  )
}

export function ProjectDeck(props: DeckProps) {
  const { destination, cockpit, actions } = props
  return (
    <main data-component="ProjectDeck" className="overflow-auto bg-background p-8">
      <div
        data-state={stateName(props)}
        className="flex max-w-[var(--size-deck)] flex-col items-start gap-2"
        aria-busy={cockpit.busy}
      >
        {destination === 'Sessions' ? (
          <SessionsScreen />
        ) : destination === 'Projects' ? (
          <ProjectPane cockpit={cockpit} actions={actions} />
        ) : (
          <SurfacePane destination={destination} />
        )}
      </div>
    </main>
  )
}
