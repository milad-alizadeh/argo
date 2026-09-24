// Connecting or disconnecting the one Ticket a Session links to (CONTEXT.md L1 · Session →
// Ticket, ADR-0017), and the rename that connecting can trigger. The link write and the rename
// are two calls: a refused or skipped rename never undoes a successful link (issue #2134).

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { invalidateSessionRoster } from '../../session-queries'
import type { Session } from '../../types'

export type ConnectTicketInput = {
  projectId: string
  key: string
  title: string
  state: 'open' | 'closed'
}

export type ConnectOutcome = {
  failure: string | null
  renamed: boolean
  // Set only when the current title is `custom` and a reader has not yet said whether to
  // replace it: the caller asks, then calls `connect` again with `confirmedRename: true`.
  needsRenameConfirmation: boolean
  renameFailure: string | null
}

type ArgoLike = {
  connectSessionTicket: (typeof window.argo)['connectSessionTicket']
  renameSession: (typeof window.argo)['renameSession']
  disconnectSessionTicket: (typeof window.argo)['disconnectSessionTicket']
}

// Exported for direct testing: the connect/rename decision itself needs no React to prove.
export async function connectTicket(request: {
  argo: ArgoLike
  session: Session
  ticket: ConnectTicketInput
  confirmedRename?: boolean
}): Promise<{ outcome: ConnectOutcome; failure: string | null; invalidate: boolean }> {
  const { argo, session, ticket, confirmedRename } = request
  const source = session.title?.source ?? null
  if (source === 'custom' && confirmedRename !== true) {
    return {
      outcome: {
        failure: null,
        renamed: false,
        needsRenameConfirmation: true,
        renameFailure: null,
      },
      failure: null,
      invalidate: false,
    }
  }
  const alreadyLinked =
    session.ticket?.projectId === ticket.projectId && session.ticket.key === ticket.key
  if (!alreadyLinked) {
    const reply = await argo.connectSessionTicket({ sessionId: session.id, ...ticket })
    if (reply.type === 'session.error') {
      return {
        outcome: {
          failure: reply.message,
          renamed: false,
          needsRenameConfirmation: false,
          renameFailure: null,
        },
        failure: reply.message,
        invalidate: false,
      }
    }
  }
  const renameReply = await argo.renameSession({ sessionId: session.id, name: ticket.title })
  if (renameReply.type === 'session.error') {
    return {
      outcome: {
        failure: null,
        renamed: false,
        needsRenameConfirmation: false,
        renameFailure: renameReply.message,
      },
      failure: null,
      invalidate: true,
    }
  }
  return {
    outcome: { failure: null, renamed: true, needsRenameConfirmation: false, renameFailure: null },
    failure: null,
    invalidate: true,
  }
}

// Exported for direct testing, mirroring `connectTicket`.
export async function disconnectTicket(
  argo: ArgoLike,
  sessionId: string,
): Promise<{ failure: string | null; invalidate: boolean }> {
  const reply = await argo.disconnectSessionTicket({ sessionId })
  if (reply.type === 'session.error') return { failure: reply.message, invalidate: false }
  return { failure: null, invalidate: true }
}

export function useSessionTicketLink() {
  const client = useQueryClient()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // Both keep one identity: a roster row's menu reaches them through a memoized row, which a
  // function rebuilt on every render would re-render on every poll tick.
  const connect = useCallback(
    async (
      session: Session,
      ticket: ConnectTicketInput,
      options: { confirmedRename?: boolean } = {},
    ): Promise<ConnectOutcome> => {
      setPending(true)
      setFailure(null)
      try {
        const result = await connectTicket({
          argo: window.argo,
          session,
          ticket,
          confirmedRename: options.confirmedRename,
        })
        if (result.failure !== null) setFailure(result.failure)
        if (result.invalidate) await invalidateSessionRoster(client)
        return result.outcome
      } finally {
        setPending(false)
      }
    },
    [client],
  )

  const disconnect = useCallback(
    async (sessionId: string) => {
      setPending(true)
      setFailure(null)
      try {
        const result = await disconnectTicket(window.argo, sessionId)
        if (result.failure !== null) setFailure(result.failure)
        if (result.invalidate) await invalidateSessionRoster(client)
      } finally {
        setPending(false)
      }
    },
    [client],
  )

  return useMemo(
    () => ({ connect, disconnect, pending, failure }),
    [connect, disconnect, failure, pending],
  )
}
