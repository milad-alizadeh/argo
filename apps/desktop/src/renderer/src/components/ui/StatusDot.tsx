import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/sessionStore'
import { SESSION_STATUS, STATUS_TONE, type StatusTone } from './sessionStatus'

type StatusDotProps = {
  /** Spend the screen's ONE animation budget on this dot. At most one per render. */
  pulse?: boolean
  className?: string
} & (
  | {
      /** Key the dot off a Session's lifecycle; its accessible name becomes that status. */
      status: SessionStatus
      /** Suppress the accessible name because a visible word already labels the dot. */
      decorative?: boolean
      tone?: never
      label?: never
    }
  | {
      /** Key the dot off a raw cockpit tone. Silent unless `label` names it. */
      tone: StatusTone
      /** What the dot means, for a dot that stands alone. */
      label?: string
      status?: never
      decorative?: never
    }
)

function presentation(props: StatusDotProps): { tone: StatusTone; label: string | undefined } {
  if (props.status === undefined) return { tone: props.tone, label: props.label }
  const { tone, label } = SESSION_STATUS[props.status]
  return { tone, label: props.decorative ? undefined : label }
}

// Atom: a lifecycle state as a small coloured dot. Keyed either by a Session's status
// (self-describing — accessible name = the status word) or by a raw cockpit `tone`, which
// is silent unless given a `label`, since a word normally sits beside it — and a state
// shown with its word is the Status molecule, not this.
// `pulse` spends the screen's ONE animation budget: at most one per render.
export function StatusDot(props: StatusDotProps): React.JSX.Element {
  const { tone, label } = presentation(props)
  const dot = cn(
    'inline-block size-2 shrink-0 rounded-full bg-current glow',
    STATUS_TONE[tone].textClass,
    props.pulse && 'motion-safe:animate-pulse-status',
    props.className,
  )
  if (label === undefined) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
