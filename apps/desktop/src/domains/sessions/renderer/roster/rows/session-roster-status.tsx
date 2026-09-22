import { useTranslation } from 'react-i18next'
import type { Session } from '../../types'
import { sessionPostureLocksAnswer } from '../../types'
import { Icon } from '@/platform/renderer/components/icon'
import { Badge } from '@/platform/renderer/components/ui/badge'

export type SessionStatusVariant = 'active' | 'attention' | 'failed' | 'idle' | 'unknown' | 'unread'

// A working Session outranks its unread result; `starting` keeps its idle mark until a Turn works.
export function statusVariantOf(session: Pick<Session, 'status' | 'unread'>): SessionStatusVariant {
  switch (session.status) {
    case 'running':
      return 'active'
    case 'starting':
      return 'idle'
    case 'asking':
    case 'permission':
      return 'attention'
    case 'ended':
    case 'stopped':
      return 'failed'
    case 'unknown':
      return 'unknown'
    case 'idle':
      return session.unread ? 'unread' : 'idle'
  }
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

const NEEDS_INPUT: Record<Session['status'], boolean> = {
  asking: true,
  ended: false,
  idle: false,
  permission: true,
  running: false,
  starting: false,
  stopped: false,
  unknown: false,
}

// An `asking` Session whose posture locks the answer affordance (#2205) cannot take an answer
// here, whatever its transcript shows.
function unanswerableHere(session: Session): boolean {
  return session.status === 'asking' && sessionPostureLocksAnswer(session.posture)
}

export function SessionBlockedBadge({ session }: { session: Session }) {
  const { t } = useTranslation('sessions')
  if (!NEEDS_INPUT[session.status]) return null
  return (
    <Badge size="compact" variant="warning">
      {t('needsInput')}
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
      <Icon name="awaiting-permission" className="size-3.5 text-faint" />
      <span className="sr-only">{OPEN_ELSEWHERE_MESSAGE}</span>
    </span>
  )
}
