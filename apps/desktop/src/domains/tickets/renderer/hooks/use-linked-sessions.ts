// Every Session linked to one Ticket (CONTEXT.md L1 · Session → Ticket), most recently linked
// first, read here from the Session list through its generated tRPC query.
import { useSessionList } from '@/domains/sessions/renderer/session-list/use-session-list'

export type LinkedSession = { id: string; title: string }

export function useLinkedSessions(projectId: string | null, key: string | null): LinkedSession[] {
  const { sessionList } = useSessionList({
    enabled: key !== null,
    projectId,
  })
  if (projectId === null || key === null || sessionList === null) return []
  return sessionList.sessions
    .filter((session) => session.ticket?.projectId === projectId && session.ticket.key === key)
    .sort((a, b) => (b.ticket?.createdAt ?? '').localeCompare(a.ticket?.createdAt ?? ''))
    .map((session) => ({ id: session.id, title: session.title?.text ?? session.id }))
}
