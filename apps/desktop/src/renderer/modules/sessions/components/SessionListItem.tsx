import type { Session } from '../types'

type SessionListItemProps = {
  session: Session
  selected: boolean
  onSelect: (sessionId: Session['id']) => void
}

export function SessionListItem({ session, selected, onSelect }: SessionListItemProps) {
  return (
    <button
      className={`w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active ${selected ? 'border-active bg-muted' : 'border-transparent hover:bg-muted/70'}`}
      onClick={() => onSelect(session.id)}
      type="button"
    >
      <span className="block truncate type-heading font-medium">{session.id}</span>
    </button>
  )
}
