import { useTranslation } from 'react-i18next'

import { SessionsEmptyState } from '../components/SessionsEmptyState'
import { useSessions } from '../hooks/useSessions'
import { useSessionsStore } from '../state/useSessionsStore'
import { SessionsScreenView } from './SessionsScreenView'

export function SessionsScreen() {
  const { t } = useTranslation()
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId)
  const selectSession = useSessionsStore((state) => state.selectSession)
  const { feed, feedError, refreshRoster, roster, rosterError } = useSessions(selectedSessionId)
  if (rosterError !== null) return <SessionsEmptyState message={rosterError} />
  if (roster === null) return <SessionsEmptyState message={t('loading')} />
  if (feedError !== null) return <SessionsEmptyState message={feedError} />
  return (
    <SessionsScreenView
      feed={feed}
      onRefresh={refreshRoster}
      onSelect={selectSession}
      selectedSessionId={selectedSessionId}
      sessions={roster.sessions}
    />
  )
}
