import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/sessionStore'
import { SESSION_STATUS } from './sessionStatus'

// Atom: a Session's live status as a small glowing dot. Self-describing by default
// (accessible name = the status); pass `decorative` when a visible status word already
// labels it, so screen readers don't hear the status twice.
export function StatusDot({
  status,
  decorative = false,
  className,
}: {
  status: SessionStatus
  decorative?: boolean
  className?: string
}): React.JSX.Element {
  const { dotClass, label } = SESSION_STATUS[status]
  const dot = cn('inline-block size-2 shrink-0 rounded-full', dotClass, className)
  if (decorative) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
