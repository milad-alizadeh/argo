import { type KeyboardEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { matchesChord, ROSTER_MOVES, SHORTCUTS } from '@/core/commands/shortcuts'

import type { Session, SessionId } from '../types'

import { SessionListItem } from './SessionListItem'

type SessionListProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  /** Which list this is, for a reader who reaches it by its name. The live Sessions by default. */
  label?: string
  onSelect: (sessionId: SessionId) => void
}

// Focus behaviour, stated: Tab enters the Roster once, at the row focus was last on — the chosen
// Session before a reader has moved, and the row they moved to afterwards. Arrow keys and
// Home/End move focus between rows without selecting, so a reader can look down the list without
// the Feed following; Enter or Space on a focused row selects it, which is what a button does
// anyway. Selection never moves focus, so choosing a Session leaves the reader where they were
// and the Feed's own scroller is the next Tab stop.
// The chords themselves are in the one shortcut table (#1786); what each one does to the focused
// index is here, keyed by the command the table declares.
const MOVES: Record<string, (index: number, last: number) => number> = {
  [ROSTER_MOVES.next]: (index, last) => Math.min(index + 1, last),
  [ROSTER_MOVES.previous]: (index) => Math.max(index - 1, 0),
  [ROSTER_MOVES.first]: () => 0,
  [ROSTER_MOVES.last]: (_index, last) => last,
}

function rosterMove(event: KeyboardEvent<HTMLUListElement>) {
  const pressed = {
    key: event.key,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  }
  const hit = SHORTCUTS.find(
    (entry) => entry.scope === 'element' && matchesChord(entry.chord, pressed),
  )
  return hit ? MOVES[hit.command] : undefined
}

export function SessionList({ sessions, selectedSessionId, label, onSelect }: SessionListProps) {
  const { t } = useTranslation()
  const list = useRef<HTMLUListElement>(null)
  // The one tab stop follows focus, so tabbing away and back returns the reader to the row they
  // were on rather than to the row they last chose.
  const [focusedSessionId, setFocusedSessionId] = useState<SessionId | null>(null)

  const move = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = rosterMove(event)
    if (step === undefined) return
    const rows = [...(list.current?.querySelectorAll('button') ?? [])]
    const index = rows.indexOf(document.activeElement as HTMLButtonElement)
    if (index === -1) return
    event.preventDefault()
    rows[step(index, rows.length - 1)]?.focus()
  }

  const stop = focusedSessionId ?? selectedSessionId ?? sessions[0]?.id ?? null

  return (
    <nav aria-label={label ?? t('navigationLabel')}>
      <ul className="roster__list flex flex-col gap-px px-2 pb-2" onKeyDown={move} ref={list}>
        {sessions.map((session) => (
          <li key={session.id}>
            <SessionListItem
              focusable={session.id === stop}
              onFocus={setFocusedSessionId}
              onSelect={onSelect}
              selected={session.id === selectedSessionId}
              session={session}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}
