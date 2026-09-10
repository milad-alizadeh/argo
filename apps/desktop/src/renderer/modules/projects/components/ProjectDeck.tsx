// The working surface: the window ground, no edge of its own (ADR-0038).
import type { Destination } from '@/core/commands/shortcuts'
import { SessionsScreen } from '../../sessions/screens/SessionsScreen'
import type { Cockpit, ProjectActions } from '../hooks/useProjects'
import { EmptyPane, LINE, RefusedPane, SelectedPane, TITLE } from './ProjectPanes'

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

function destinationPane({ destination, cockpit, actions }: DeckProps) {
  if (destination === 'Projects') return <ProjectPane cockpit={cockpit} actions={actions} />
  return <SurfacePane destination={destination} />
}

export function ProjectDeck(props: DeckProps) {
  const { cockpit, destination } = props
  // Sessions is a screen rather than a pane: it owns two scroll boxes of its own and its own
  // edges, and its Feed measures rows at the width it is given (ADR-0033 rule 3). So it is handed
  // the whole deck, undivided and unpadded. The reading column and the page padding below are for
  // the prose surfaces, and a screen drawn inside them would be measured at 640px in the middle of
  // a window twice that wide.
  //
  // The one column is `minmax(0, 1fr)` and the screen is `min-w-0`, so the deck's width is the
  // window's and never the widest row's: an `auto` column grows to its content, and the Feed then
  // measures at the grown width, writes it on, and grows the column again. The deck is also the
  // containing block of anything positioned inside it, so a visually hidden label cannot escape a
  // pane's scroll box and make the whole window scroll.
  if (destination === 'Sessions') {
    return (
      <main
        data-component="ProjectDeck"
        className="relative grid min-h-0 grid-cols-1 overflow-hidden bg-background"
      >
        <div data-state={stateName(props)} className="min-h-0 min-w-0">
          <SessionsScreen />
        </div>
      </main>
    )
  }
  return (
    <main data-component="ProjectDeck" className="overflow-auto bg-background p-8">
      <div
        data-state={stateName(props)}
        className="flex max-w-[var(--size-deck)] flex-col items-start gap-2"
        aria-busy={cockpit.busy}
      >
        {destinationPane(props)}
      </div>
    </main>
  )
}
