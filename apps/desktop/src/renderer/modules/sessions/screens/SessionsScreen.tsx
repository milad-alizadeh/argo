import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SessionsEmptyState } from '../components/SessionsEmptyState'
import { useSessions } from '../hooks/useSessions'
import { useSessionsStore } from '../state/useSessionsStore'
import { SessionsScreenView } from './SessionsScreenView'

export function SessionsScreen({ projectHeader }: { projectHeader?: ReactNode }) {
  const { t } = useTranslation()
  const selectedSessionId = useSessionsStore((state) => state.selectedSessionId)
  const selectSession = useSessionsStore((state) => state.selectSession)
  const { feed, feedError, roster, rosterError, reread } = useSessions(selectedSessionId)

  // A pass that failed replaces nothing. The reading on hand is older than the reader asked for
  // and the Roster head says so, but a Roster and a Feed they can still read beat an error page
  // whose only way back — the button that asks for another pass — is on the page it replaced. So
  // the only state that stands alone is having no reading at all.
  if (roster === null) return <SessionsEmptyState title={rosterError ?? t('loading')} />

  return (
    <SessionsScreenView
      feed={feed}
      failure={rosterError}
      onReread={reread}
      onSelect={selectSession}
      projectHeader={projectHeader}
      selectedSessionId={selectedSessionId}
      sessions={roster.sessions}
      feedFailure={feedError}
    />
  )
}
