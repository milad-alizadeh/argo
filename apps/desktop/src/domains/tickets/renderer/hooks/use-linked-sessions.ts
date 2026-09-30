// Every Session linked to one Ticket (CONTEXT.md L1 · Session → Ticket), most recently linked
// first, as the Session List reads them.
import { useSessionListQuery } from '@/domains/sessions/renderer'

export type LinkedSession = { id: string; title: string }

export function useLinkedSessions(projectId: string | null, key: string | null): LinkedSession[] {
  const { data, isPlaceholderData } = useSessionListQuery(
    { projectId: projectId ?? '', filter: 'active', search: '', ticketKey: key ?? undefined },
    projectId !== null && key !== null,
  )
  // The previous Ticket's Sessions are a placeholder, never this Ticket's.
  if (projectId === null || key === null || data === undefined || isPlaceholderData) return []
  return data.pages
    .flatMap((page) => page.rows)
    .map((session) => ({ id: session.id, title: session.title?.text ?? session.id }))
}
