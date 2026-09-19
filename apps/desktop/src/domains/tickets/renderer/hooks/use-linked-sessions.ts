// Every Session linked to one Ticket (CONTEXT.md L1 · Session → Ticket), most recently linked
// first — the same ordering the Roster's own link store keeps, read here from the Roster the
// Sessions module already polls rather than a second reader.
import { useSessions } from '@/domains/sessions/renderer/hooks/use-sessions'

export type LinkedSession = { id: string; title: string }

export function useLinkedSessions(projectId: string | null, key: string | null): LinkedSession[] {
  const { roster } = useSessions(null, key !== null)
  if (projectId === null || key === null || roster === null) return []
  return roster.sessions
    .filter((session) => session.ticket?.projectId === projectId && session.ticket.key === key)
    .sort((a, b) => (b.ticket?.createdAt ?? '').localeCompare(a.ticket?.createdAt ?? ''))
    .map((session) => ({ id: session.id, title: session.title?.text ?? session.id }))
}
