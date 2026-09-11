// The working surface: the window ground, no edge of its own (ADR-0038).
import type { ReactNode } from 'react'
import type { Destination } from '@/core/commands/shortcuts'
import { SessionsScreen } from '../../sessions/screens/SessionsScreen'
import type { Cockpit, ProjectActions } from '../hooks/useProjects'
import { EmptyPane, LINE, RefusedPane, TITLE } from './ProjectPanes'

type DeckProps = {
  destination: Destination
  cockpit: Cockpit
  actions: ProjectActions
  projectHeader?: ReactNode
}

// The names the design ticket froze, so a state render is found by the name the design shows. The
// name is the Project's, never the destination's: the Project is what the deck is standing on, and
// a turned-away folder is named by the error code rather than by a single spelling for every
// refusal, so `not-a-repository` cannot stand in for a git that will not run. `refused` keeps its
// own name: there the message is about the open Project, not about a folder just chosen.
export function deckState(cockpit: Cockpit): string {
  if (cockpit.status === 'refused') return 'refused'
  return cockpit.code ?? cockpit.status
}

// Nothing is open yet, so nothing else is on screen: the gate takes the window and stands in the
// middle of it, on both axes.
const GATE = {
  frame: 'grid min-h-0 place-items-center overflow-auto bg-background p-8',
  pane: 'flex w-full justify-center',
}

// Sessions is a screen rather than a pane: it owns two scroll boxes of its own and its own edges,
// and its Feed measures rows at the width it is given (ADR-0033 rule 3). So it is handed the whole
// deck, undivided and unpadded. The reading column and the page padding of the prose surfaces
// would measure it at 640px in the middle of a window twice that wide.
//
// The one column is `minmax(0, 1fr)` and the screen is `min-w-0`, so the deck's width is the
// window's and never the widest row's: an `auto` column grows to its content, and the Feed then
// measures at the grown width, writes it on, and grows the column again. The deck is also the
// containing block of anything positioned inside it, so a visually hidden label cannot escape a
// pane's scroll box and make the whole window scroll.
const SCREEN = {
  frame: 'relative grid min-h-0 grid-cols-1 overflow-hidden bg-background',
  pane: 'min-h-0 min-w-0',
}

const PROSE = {
  frame: 'overflow-auto bg-background p-8',
  pane: 'flex max-w-[var(--size-deck)] flex-col items-start gap-2',
}

function gatePane(cockpit: Cockpit, onOpen: () => void): ReactNode {
  const { status, project, message, busy } = cockpit
  // The first listing draws nothing rather than an empty state it is about to replace.
  if (status === 'loading') return null
  if (status === 'refused' && project && message) {
    return <RefusedPane project={project} message={message} busy={busy} onOpen={onOpen} />
  }
  return <EmptyPane message={message} busy={busy} onOpen={onOpen} />
}

// Every destination is reachable and says so. Code is a placeholder in this slice and is drawn the
// same way, because a surface that answers nothing still has to answer the click.
function SurfacePane({ destination }: { destination: Destination }) {
  return (
    <>
      <h1 className={TITLE}>{destination}</h1>
      <p className={LINE}>This surface is not built yet.</p>
    </>
  )
}

// One `<main>` and one state element for every screen the deck can be, at the same place in the
// tree. A live driver watches that element for the busy window a press opens and closes, and an
// element replaced between the press and the reply is an observer attached to a detached node.
export function ProjectDeck({ destination, cockpit, actions, projectHeader }: DeckProps) {
  const screen = deckScreen(destination, cockpit)
  const shape = SHAPES[screen]
  return (
    <main data-component="ProjectDeck" className={shape.frame}>
      <div data-state={deckState(cockpit)} aria-busy={cockpit.busy} className={shape.pane}>
        <DeckPane
          screen={screen}
          destination={destination}
          cockpit={cockpit}
          onOpen={actions.open}
          projectHeader={projectHeader}
        />
      </div>
    </main>
  )
}

type DeckScreen = 'gate' | 'sessions' | 'prose'

const SHAPES: Record<DeckScreen, { frame: string; pane: string }> = {
  gate: GATE,
  sessions: SCREEN,
  prose: PROSE,
}

function deckScreen(destination: Destination, cockpit: Cockpit): DeckScreen {
  switch (cockpit.status) {
    case 'loading':
    case 'empty':
    case 'refused':
      return 'gate'
    case 'selected':
      switch (destination) {
        case 'Sessions':
          return 'sessions'
        case 'Tickets':
        case 'Atlas':
        case 'Code':
          return 'prose'
      }
  }
}

function DeckPane({
  screen,
  destination,
  cockpit,
  onOpen,
  projectHeader,
}: {
  screen: DeckScreen
  destination: Destination
  cockpit: Cockpit
  onOpen: () => void
  projectHeader?: ReactNode
}) {
  if (screen === 'gate') return gatePane(cockpit, onOpen)
  if (screen === 'sessions') return <SessionsScreen projectHeader={projectHeader} />
  return <SurfacePane destination={destination} />
}
