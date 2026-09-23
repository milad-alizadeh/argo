import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { settle } from '@/platform/renderer/lib/query-client'
import type { Session } from '../../types'
import { ticketKeyForSession } from './ticket-key-for-session'
import type { ConnectOutcome, ConnectTicketInput } from './use-session-ticket-link'

type ReportRenameFailure = (message: string) => void

function derivedTicket(session: Session): string | null {
  return session.ticket === null ? ticketKeyForSession(session) : null
}

async function retryPendingRename(
  sessionId: string,
  ticket: ConnectTicketInput,
  reportFailure: ReportRenameFailure,
) {
  try {
    const reply = await window.argo.renameSession({ sessionId, name: ticket.title })
    if (reply.type === 'session.error') reportFailure(reply.message)
  } catch (error) {
    reportFailure(error instanceof Error ? error.message : String(error))
  }
}

async function connectDerivedTicket(options: {
  attempt: string
  attempted: Set<string>
  connect: (session: Session, ticket: ConnectTicketInput) => Promise<ConnectOutcome>
  pendingRenames: ReturnType<typeof createPendingTicketRenames>
  projectId: string
  reportFailure: ReportRenameFailure
  session: Session
  ticketKey: string
}) {
  const {
    attempt,
    attempted,
    connect,
    pendingRenames,
    projectId,
    reportFailure,
    session,
    ticketKey,
  } = options
  try {
    const listed = await settle(
      window.argo.listTickets({ projectId, query: ticketKey, cursor: null }),
    )
    const ticket = listed.tickets.find((entry) => entry.key === ticketKey)
    if (ticket === undefined) return
    const input = { projectId, key: ticket.key, title: ticket.title, state: ticket.state }
    const outcome = await connect(session, input)
    if (outcome.renameFailure === null) return
    reportFailure(outcome.renameFailure)
    if (session.posture === 'watched') pendingRenames.queue(session.id, input)
  } catch {
    attempted.delete(attempt)
  }
}

export function createPendingTicketRenames() {
  const pending = new Map<string, ConnectTicketInput>()
  return {
    queue: (sessionId: string, ticket: ConnectTicketInput) => pending.set(sessionId, ticket),
    takeWhenManaged: (
      sessionId: string,
      posture: Session['posture'],
      linkedTicket: Session['ticket'],
    ) => {
      const ticket = pending.get(sessionId)
      if (ticket === undefined) return undefined
      if (posture !== 'managed') return null
      pending.delete(sessionId)
      if (linkedTicket?.projectId !== ticket.projectId || linkedTicket.key !== ticket.key)
        return null
      return ticket
    },
  }
}

export async function processDerivedSession(options: {
  attempted: Set<string>
  connect: (session: Session, ticket: ConnectTicketInput) => Promise<ConnectOutcome>
  pendingRenames: ReturnType<typeof createPendingTicketRenames>
  projectId: string
  reportFailure: ReportRenameFailure
  session: Session
}) {
  const { attempted, connect, pendingRenames, projectId, reportFailure, session } = options
  const pendingRename = pendingRenames.takeWhenManaged(session.id, session.posture, session.ticket)
  if (pendingRename !== undefined) {
    if (pendingRename !== null) await retryPendingRename(session.id, pendingRename, reportFailure)
    return
  }
  const key = derivedTicket(session)
  if (key === null) return
  const attempt = `${projectId}:${session.id}:${key}`
  if (attempted.has(attempt)) return
  attempted.add(attempt)
  await connectDerivedTicket({
    attempt,
    attempted,
    connect,
    pendingRenames,
    projectId,
    reportFailure,
    session,
    ticketKey: key,
  })
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
  const pendingRenames = useRef(createPendingTicketRenames())
  const { t } = useTranslation('sessions')
  const { add } = useToastManager()
  const reportFailure = useCallback(
    (message: string) =>
      add({
        title: t('ticketLink.autoRenameFailed'),
        description: message,
        type: 'error',
        priority: 'high',
      }),
    [add, t],
  )
  useEffect(() => {
    if (projectId === null) return
    for (const session of sessions) {
      void processDerivedSession({
        attempted: attempted.current,
        connect,
        pendingRenames: pendingRenames.current,
        projectId,
        reportFailure,
        session,
      })
    }
  }, [connect, projectId, reportFailure, sessions])
}
