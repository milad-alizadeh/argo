import { useParams } from 'react-router'

import { useSessions } from '../hooks/useSessions'
import { SessionScreenView } from './SessionScreenView'

export function SessionRoute() {
  const { sessionId } = useParams()
  const { roster } = useSessions(sessionId ?? null)

  if (sessionId === undefined) return null

  const session = roster?.sessions.find(({ id }) => id === sessionId)
  const sessionLocation = [session?.cwd, session?.branch].filter(
    (value): value is string => value !== null && value !== undefined,
  ).join(' ')

  return <SessionScreenView sessionLocation={sessionLocation} sessionTitle={session?.title?.text ?? sessionId} />
}
