// Every Session linked to one Ticket (CONTEXT.md L1 · Session → Ticket), most recently linked
// first, read here from the first Session List window through its generated tRPC query.
import { useSessionListSnapshot } from '@/domains/sessions/renderer'

export type LinkedSession = { id: string; title: string }

export function useLinkedSessions(projectId: string | null, key: string | null): LinkedSession[] {
  const window = useSessionListSnapshot(projectId, key !== null)
  if (projectId === null || key === null || window === undefined) return []
  return window.rows
    .filter((session) => session.ticket?.projectId === projectId && session.ticket.key === key)
    .sort((a, b) => (b.ticket?.createdAt ?? '').localeCompare(a.ticket?.createdAt ?? ''))
    .map((session) => ({ id: session.id, title: session.title?.text ?? session.id }))
}
