import { useTranslation } from 'react-i18next'

import type { Session, SessionId } from '../types'

import { SessionListItem } from './SessionListItem'

type SessionListProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  onSelect: (sessionId: SessionId) => void
}

export function SessionList({ sessions, selectedSessionId, onSelect }: SessionListProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('navigationLabel')} className="divide-y divide-rule/70">
      {sessions.map((session) => (
        <SessionListItem
          key={session.id}
          onSelect={onSelect}
          selected={session.id === selectedSessionId}
          session={session}
        />
      ))}
    </nav>
  )
}
