import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/sessionStore'

// Atom: a Session's live status as a coloured dot with an accessible name, so the
// status is legible to sighted users (colour) and screen readers (label) alike.
const STATUS: Record<SessionStatus, { tone: string; label: string }> = {
  working: { tone: 'bg-status-working', label: 'Working' },
  idle: { tone: 'bg-status-idle', label: 'Idle' },
  'awaiting-input': { tone: 'bg-status-awaiting-input', label: 'Awaiting input' },
  exited: { tone: 'bg-status-exited', label: 'Exited' },
}

export function StatusDot({
  status,
  className,
}: {
  status: SessionStatus
  className?: string
}): React.JSX.Element {
  const { tone, label } = STATUS[status]
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-block size-2 shrink-0 rounded-full', tone, className)}
    />
  )
}
