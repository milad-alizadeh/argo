import { ticketKeyInPlace } from '@/domains/tickets/contract/branch-ticket'
import type { Session } from '../../types'

export function ticketKeyForSession(
  session: Pick<Session, 'ticket' | 'branch' | 'cwd'>,
): string | null {
  return session.ticket?.key ?? ticketKeyInPlace(session.branch, session.cwd)
}

export function ticketRouteForSession(
  session: Pick<Session, 'ticket' | 'branch' | 'cwd'>,
): string | null {
  const ticketKey = ticketKeyForSession(session)
  return ticketKey === null ? null : `/tickets/${encodeURIComponent(ticketKey)}`
}
