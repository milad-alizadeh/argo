import { useRef, useState } from 'react'
import { counted } from '../sessions/reading-note'
import type { RosterRow } from '../sessions/roster'
import { StatusMark } from './StatusMark'

export type RosterProps = {
  sessions: RosterRow[]
  selectedId: string | null
  onSelect: (sessionId: string) => void
}

// Focus behaviour, stated: Tab enters the Roster once, at the row focus was last on — the chosen
// Session before a reader has moved, and the row they moved to afterwards. Arrow keys and
// Home/End move focus between rows without selecting, so a reader can look down the list without
// the Feed following; Enter or Space on a focused row selects it, which is what a button does
// anyway. Selection never moves focus, so choosing a Session leaves the reader where they were
// and the Feed's own scroller is the next Tab stop.
const MOVES: Record<string, (index: number, last: number) => number> = {
  ArrowDown: (index, last) => Math.min(index + 1, last),
  ArrowUp: (index) => Math.max(index - 1, 0),
  Home: () => 0,
  End: (_index, last) => last,
}

export function Roster({ sessions, selectedId, onSelect }: RosterProps) {
  const list = useRef<HTMLUListElement>(null)
  // The one tab stop follows focus, so tabbing away and back returns the reader to the row they
  // were on rather than to the row they last chose.
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const move = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const step = MOVES[event.key]
    if (step === undefined) return
    const rows = [...(list.current?.querySelectorAll('button') ?? [])]
    const index = rows.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return
    event.preventDefault()
    rows[step(index, rows.length - 1)]?.focus()
  }

  const stop = focusedId ?? selectedId ?? sessions[0]?.id ?? null
  return (
    <nav className="roster" aria-label="Sessions">
      <ul className="roster__list" ref={list} onKeyDown={move}>
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              className="roster__row"
              aria-current={session.id === selectedId}
              tabIndex={session.id === stop ? 0 : -1}
              onFocus={() => setFocusedId(session.id)}
              onClick={() => onSelect(session.id)}
            >
              <StatusMark status={session.status} />
              <span className="roster__name">{session.title?.text ?? session.id}</span>
              <SessionFacts session={session} />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Every fact here is DERIVED — read off a transcript Argo does not own — and the ones it cannot
// establish are drawn as absent rather than as a plausible value.
function SessionFacts({ session }: { session: RosterRow }) {
  return (
    <span className="roster__facts">
      <span className="roster__posture">{session.posture}</span>
      {session.entry === 'headless' ? <span className="roster__entry">headless</span> : null}
      {session.cwd === null ? (
        <span className="roster__place--absent">working directory unknown</span>
      ) : (
        <span className="roster__place">{session.cwd}</span>
      )}
      {session.branch === null ? null : <span className="roster__branch">{session.branch}</span>}
      {session.unreadableLines === 0 ? null : (
        <span className="roster__damage">
          {counted(session.unreadableLines, 'unreadable line')}
        </span>
      )}
      {/* This row is a resumed half, not a beginning. Said on the row rather than in the note
          above the list, because it is true of this Session and not of the pass. */}
      {session.originUnread ? (
        <span className="roster__partial">continues a Session Argo did not read</span>
      ) : null}
    </span>
  )
}
