import type { KeyboardEvent } from 'react'
import type { Session, SessionId } from '../types'
import { SessionRosterItem } from './SessionRosterItem'

type Props = {
  items: Session[]
  label: string
  onFocus: (sessionId: SessionId) => void
  onRename: (session: Session) => void
  onSelect: (sessionId: SessionId) => void
  renamedTitles: Record<string, string>
  selectedSessionId: SessionId | null
  tabStop: SessionId | null
}

function moveFocus(event: KeyboardEvent<HTMLUListElement>) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current === -1) return
  event.preventDefault()
  const nextByKey = {
    ArrowDown: Math.min(current + 1, buttons.length - 1),
    ArrowUp: Math.max(current - 1, 0),
    End: buttons.length - 1,
    Home: 0,
  }
  buttons[nextByKey[event.key as keyof typeof nextByKey]]?.focus()
}

export function SessionRosterList({
  items,
  label,
  onFocus,
  onRename,
  onSelect,
  renamedTitles,
  selectedSessionId,
  tabStop,
}: Props) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-1 px-3" onKeyDown={moveFocus}>
        {items.map((session) => {
          const title = renamedTitles[session.id]
          const renamed =
            title === undefined
              ? session
              : { ...session, title: { text: title, source: 'custom' as const } }
          return (
            <SessionRosterItem
              key={session.id}
              onFocus={() => onFocus(session.id)}
              onRename={() => onRename(renamed)}
              onSelect={() => onSelect(session.id)}
              selected={session.id === selectedSessionId}
              session={renamed}
              tabIndex={session.id === tabStop ? 0 : -1}
            />
          )
        })}
      </ul>
    </nav>
  )
}
