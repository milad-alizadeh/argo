// Every Session linked to one Ticket (CONTEXT.md L1 · Session → Ticket), most recently linked
// first, as the Session List reads them.
import { useEffect } from 'react'
import { type Session, useSessionListQuery } from '@/domains/sessions/renderer'

export function useLinkedSessions(projectId: string | null, key: string | null): Session[] {
  const { data, isPlaceholderData, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSessionListQuery(
      { projectId: projectId ?? '', filter: 'active', search: '', ticketKey: key ?? undefined },
      projectId !== null && key !== null,
    )
  // The detail lists every linked Session, so it reads page after page to the end.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  // The previous Ticket's Sessions are a placeholder, never this Ticket's.
  if (projectId === null || key === null || data === undefined || isPlaceholderData) return []
  return data.pages.flatMap((page) => page.rows)
}
