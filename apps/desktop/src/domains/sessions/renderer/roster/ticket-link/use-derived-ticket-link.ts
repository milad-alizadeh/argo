import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import { settle } from '@/platform/renderer/lib/query-client'
import type { Session } from '../../types'
import { ticketKeyForSession } from './ticket-key-for-session'
import type { ConnectOutcome, ConnectTicketInput } from './use-session-ticket-link'

type ReportRenameFailure = (message: string) => void
type Connect = (
  session: Session,
  ticket: ConnectTicketInput,
  options?: { confirmedRename?: boolean; preserveCustomTitle?: boolean },
) => Promise<ConnectOutcome>

function derivedTicket(session: Session): string | null {
  if (session.ticket === null) return ticketKeyForSession(session)
  return session.ticket.key
}

async function retryPendingRename(options: {
  session: Session
  ticket: ConnectTicketInput
  connect: Connect
  pendingRenames: ReturnType<typeof createPendingTicketRenames>
  reportFailure: ReportRenameFailure
}) {
  const { session, ticket, connect, pendingRenames, reportFailure } = options
  const outcome = await connect(session, ticket, { confirmedRename: true })
  if (outcome.failure !== null) reportFailure(outcome.failure)
  if (outcome.renameFailure === null) return
  reportFailure(outcome.renameFailure)
  pendingRenames.queue(session.id, ticket, Date.now() + 5_000)
}

async function connectDerivedTicket(options: {
  attempt: string
  attempted: Set<string>
  connect: Connect
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
    const resolved = await settle(window.argo.readTicket({ projectId, key: ticketKey }))
    const ticket = resolved.ticket
    if (ticket === null) return
    if (session.ticket?.key === ticket.key && session.title?.text === ticket.title) return
    const input = { projectId, key: ticket.key, title: ticket.title, state: ticket.state }
    const outcome = await connect(session, input, { preserveCustomTitle: true })
    if (outcome.failure !== null) {
      reportFailure(outcome.failure)
      return
    }
    if (outcome.renameFailure === null) return
    reportFailure(outcome.renameFailure)
    pendingRenames.queue(session.id, input, session.posture === 'managed' ? Date.now() + 5_000 : 0)
  } catch (error) {
    reportFailure(error instanceof Error ? error.message : String(error))
    attempted.delete(attempt)
  }
}

export function createPendingTicketRenames() {
  const pending = new Map<string, { ticket: ConnectTicketInput; retryAt: number }>()
  return {
    queue: (sessionId: string, ticket: ConnectTicketInput, retryAt = 0) =>
      pending.set(sessionId, { ticket, retryAt }),
    takeWhenManaged: (options: {
      sessionId: string
      posture: Session['posture']
      linkedTicket: Session['ticket']
      now?: number
    }) => {
      const { sessionId, posture, linkedTicket, now = Date.now() } = options
      const entry = pending.get(sessionId)
      if (entry === undefined) return undefined
      if (posture !== 'managed') return null
      if (now < entry.retryAt) return null
      pending.delete(sessionId)
      const { ticket } = entry
      if (linkedTicket?.projectId !== ticket.projectId || linkedTicket.key !== ticket.key)
        return null
      return ticket
    },
  }
}

export async function processDerivedSession(options: {
  attempted: Set<string>
  connect: Connect
  pendingRenames: ReturnType<typeof createPendingTicketRenames>
  projectId: string
  reportFailure: ReportRenameFailure
  session: Session
}) {
  const { attempted, connect, pendingRenames, projectId, reportFailure, session } = options
  const pendingRename = pendingRenames.takeWhenManaged({
    sessionId: session.id,
    posture: session.posture,
    linkedTicket: session.ticket,
  })
  if (pendingRename !== undefined) {
    if (pendingRename !== null) {
      await retryPendingRename({
        session,
        ticket: pendingRename,
        connect,
        pendingRenames,
        reportFailure,
      })
    }
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
