import { useTranslation } from 'react-i18next'
import { Badge } from '@/platform/renderer/components/ui/badge'
import type { Session } from '../../types'

export type SessionStatusVariant = 'active' | 'attention' | 'failed' | 'idle' | 'unknown'

// `starting` keeps its idle mark until a Turn works.
export function statusVariantOf(session: Pick<Session, 'status'>): SessionStatusVariant {
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
      return 'idle'
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

export function SessionBlockedBadge({ session }: { session: Session }) {
  const { t } = useTranslation('sessions')
  if (!NEEDS_INPUT[session.status]) return null
  return (
    <Badge size="compact" variant="warning">
      {t('needsInput')}
    </Badge>
  )
}
