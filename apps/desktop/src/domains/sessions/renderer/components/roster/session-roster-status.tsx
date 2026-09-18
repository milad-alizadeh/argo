import { Lock } from 'lucide-react'

import { Badge } from '../../../../../platform/renderer/components/ui/badge'
import type { Session } from '../../types'
import { sessionPostureLocksAnswer } from '../../types'

export const STATUS_MARKS: Record<Session['status'], string> = {
  asking: 'bg-warn',
  ended: 'bg-danger',
  idle: 'bg-idle',
  permission: 'bg-warn',
  running: 'bg-active shadow-state-glow',
  starting: 'bg-active shadow-state-glow',
  stopped: 'bg-danger',
  unknown: 'bg-transparent shadow-state-outline',
}

// The dot beside a Session carries its status as colour; this is that same fact in words, for a
// reader the dot's colour never reaches (apps/desktop/AGENTS.md "Accessible names").
export const STATUS_LABELS: Record<Session['status'], string> = {
  asking: 'Asking',
  ended: 'Ended',
  idle: 'Idle',
  permission: 'Waiting on permission',
  running: 'Running',
  starting: 'Starting',
  stopped: 'Stopped',
  unknown: 'Unknown',
}

// The two blocking statuses the dot already colours `bg-warn` for, named so a reader can tell
// which one without opening the Session (#2088). Every other status shows no badge.
const BLOCKED_BADGE_LABELS: Partial<Record<Session['status'], string>> = {
  asking: 'Answer',
  permission: 'Permission Approval',
}

// An `asking` Session whose posture locks the answer affordance (#2205) cannot take an answer
// here, whatever its transcript shows.
function unanswerableHere(session: Session): boolean {
  return session.status === 'asking' && sessionPostureLocksAnswer(session.posture)
}

export function SessionBlockedBadge({ session }: { session: Session }) {
  if (unanswerableHere(session)) return null
  const label = BLOCKED_BADGE_LABELS[session.status]
  if (label === undefined) return null
  return (
    <Badge className="border-warn/40 text-warn" size="compact" variant="outline">
      {label}
    </Badge>
  )
}

// Another process runs this Session live (ADR-0040), or it is asking a question
// from a PTY Argo never opened (#2205): either way Send is refused, so the fact goes in text
// beside the title rather than only in a tooltip (apps/desktop/AGENTS.md "Accessible names" — a
// mark that is not a control).
const OPEN_ELSEWHERE_MESSAGE =
  'This session is open in another app. Close it there to continue it in Argo.'

export function SessionLockedMark({ session }: { session: Session }) {
  if (session.locked !== true && !unanswerableHere(session)) return null
  return (
    <span className="inline-flex shrink-0 items-center" title={OPEN_ELSEWHERE_MESSAGE}>
      <Lock aria-hidden className="size-3.5 text-faint" />
      <span className="sr-only">{OPEN_ELSEWHERE_MESSAGE}</span>
    </span>
  )
}
