import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/sessionStore'
import { SESSION_STATUS, STATUS_TONE, type StatusTone } from './sessionStatus'

type StatusDotProps = { pulse?: boolean; className?: string } & (
  | { status: SessionStatus; decorative?: boolean; tone?: never; label?: never }
  | { tone: StatusTone; label?: string; status?: never; decorative?: never }
)

function presentation(props: StatusDotProps): { tone: StatusTone; label: string | undefined } {
  if (props.status === undefined) return { tone: props.tone, label: props.label }
  const { tone, label } = SESSION_STATUS[props.status]
  return { tone, label: props.decorative ? undefined : label }
}

// Atom: a lifecycle state as a small coloured dot. Keyed either by a Session's status
// (self-describing — accessible name = the status word) or by a raw cockpit `tone`, which
// is silent unless given a `label`, since a StatusWord normally sits beside it.
// `pulse` spends the screen's ONE animation budget: at most one per render.
export function StatusDot(props: StatusDotProps): React.JSX.Element {
  const { tone, label } = presentation(props)
  const dot = cn(
    'inline-block size-2 shrink-0 rounded-full',
    STATUS_TONE[tone].dotClass,
    props.pulse && 'motion-safe:animate-pulse-status',
    props.className,
  )
  if (label === undefined) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
