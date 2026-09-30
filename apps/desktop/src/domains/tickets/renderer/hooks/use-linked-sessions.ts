// Every Session linked to one Ticket (CONTEXT.md L1 · Session → Ticket), most recently linked
// first, read here from the Session list through its generated tRPC query.
import { useSessionListQuery } from '@/domains/sessions/renderer'

export type LinkedSession = { id: string; title: string }

export function useLinkedSessions(projectId: string | null, key: string | null): LinkedSession[] {
  const { data } = useSessionListQuery(
    { projectId: projectId ?? '', filter: 'active', search: '' },
    projectId !== null && key !== null,
  )
  if (projectId === null || key === null || data === undefined) return []
  return data.pages
    .flatMap((page) => page.rows)
    .filter((session) => session.ticket?.projectId === projectId && session.ticket.key === key)
    .sort((a, b) => (b.ticket?.createdAt ?? '').localeCompare(a.ticket?.createdAt ?? ''))
    .map((session) => ({ id: session.id, title: session.title?.text ?? session.id }))
}
