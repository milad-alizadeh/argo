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

export function SessionBlockedBadge({ session }: { session: Session }) {
  const { t } = useTranslation('sessions')
  if (statusVariantOf(session) !== 'attention') return null
  return (
    <Badge size="compact" variant="warning">
      {t('needsInput')}
    </Badge>
  )
}
