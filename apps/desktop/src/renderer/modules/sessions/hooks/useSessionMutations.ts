import { useMutation } from '@tanstack/react-query'

import type { SessionStarted } from '@/core/sessions/contract'
import type { SessionCli } from '../harness/harnesses'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import type { TurnSetup } from '../turn-setup/turn-setup'

type Turn = { prompt: string; setup: TurnSetup | null }

// One mutation hook for every CLI (#2030): each adapter validates its own Turn-setup shape at
// its own boundary, so this hook passes `setup` through rather than choosing a schema for it.
export function useSessionMutations() {
  const compact = useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await window.argo.compactSession({ sessionId })
      switch (reply.type) {
        case 'session.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const interrupt = useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await window.argo.interruptSession({ sessionId })
      switch (reply.type) {
        case 'session.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const send = useMutation<void, SessionContractError, Turn & { sessionId: string }>({
    mutationFn: async ({ prompt, sessionId, setup }) => {
      const reply = await window.argo.sendSession({ sessionId, prompt, setup: setup ?? undefined })
      switch (reply.type) {
        case 'session.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const start = useMutation<
    SessionStarted,
    SessionContractError,
    Turn & { cli: SessionCli; cwd: string }
  >({
    mutationFn: async ({ cli, cwd, prompt, setup }) => {
      const reply = await window.argo.startSession({ cli, cwd, prompt, setup: setup ?? undefined })
      switch (reply.type) {
        case 'session.started':
          return reply
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })

  return { compact, interrupt, send, start }
}
