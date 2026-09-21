import { useEffect, useRef } from 'react'
import type { Session } from '@/domains/sessions/renderer/types'
import { ticketKeyInPlace } from '@/domains/tickets/contract/branch-ticket'
import { settle } from '@/platform/renderer/lib/query-client'
import type { ConnectOutcome, ConnectTicketInput } from './use-session-ticket-link'

function derivedTicket(session: Session): string | null {
  if (session.ticket !== null) return null
  return ticketKeyInPlace(session.branch, session.cwd)
}

export function useDerivedTicketLink({
  projectId,
  sessions,
  connect,
}: {
  projectId: string | null
  sessions: readonly Session[]
  connect: (session: Session, ticket: ConnectTicketInput) => Promise<ConnectOutcome>
}) {
  const attempted = useRef(new Set<string>())
  useEffect(() => {
    if (projectId === null) return
    for (const session of sessions) {
      const key = derivedTicket(session)
      if (key === null) continue
      const attempt = `${projectId}:${session.id}:${key}`
      if (attempted.current.has(attempt)) continue
      attempted.current.add(attempt)
      void (async () => {
        try {
          const listed = await settle(
            window.argo.listTickets({ projectId, query: key, cursor: null }),
          )
          const ticket = listed.tickets.find((entry) => entry.key === key)
          if (ticket === undefined) return
          await connect(session, {
            projectId,
            key: ticket.key,
            title: ticket.title,
            state: ticket.state,
          })
        } catch {
          attempted.current.delete(attempt)
        }
      })()
    }
  }, [connect, projectId, sessions])
}
