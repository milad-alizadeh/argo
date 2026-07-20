import { cn } from '@/lib/utils'
import type { SessionStatus } from '@/sessionStore'
import { STATUS_STATE, STATUS_TONE, type StatusTone } from './sessionStatus'

type StatusDotProps = {
  /** Spend the screen's ONE animation budget on this dot. At most one per render. */
  pulse?: boolean
  className?: string
} & (
  | {
      /** Key the dot off a Session's status; its accessible name becomes that word. */
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

function toneAndLabel(props: StatusDotProps): { tone: StatusTone; label: string | undefined } {
  if (props.status === undefined) return { tone: props.tone, label: props.label }
  const { word, tone } = STATUS_STATE[props.status]
  return { tone, label: props.decorative ? undefined : word }
}

// Atom: a state as a small coloured dot, keyed either by a Session's status
// (accessible name = the status word) or by a raw cockpit `tone`, which is silent unless
// given a `label`. A state shown with its word beside it is the Status molecule, not this.
export function StatusDot(props: StatusDotProps): React.JSX.Element {
  const { tone, label } = toneAndLabel(props)
  const dot = cn(
    'inline-block size-2 shrink-0 rounded-full bg-current glow',
    STATUS_TONE[tone],
    props.pulse && 'motion-safe:animate-pulse-status',
    props.className,
  )
  if (label === undefined) return <span aria-hidden className={dot} />
  return <span role="img" aria-label={label} className={dot} />
}
