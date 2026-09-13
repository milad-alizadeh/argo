import { useMutation } from '@tanstack/react-query'

import type { ClaudeSessionStarted } from '@/core/sessions/contract'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'

export function useClaudeSessionMutations() {
  const interrupt = useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await window.argo.interruptClaudeSession({
        version: 1,
        type: 'session.claude.interrupt',
        requestId: crypto.randomUUID(),
        sessionId,
      })
      switch (reply.type) {
        case 'session.claude.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const send = useMutation<void, SessionContractError, { prompt: string; sessionId: string }>({
    mutationFn: async ({ prompt, sessionId }: { prompt: string; sessionId: string }) => {
      const reply = await window.argo.sendClaudeSession({
        version: 1,
        type: 'session.claude.send',
        requestId: crypto.randomUUID(),
        sessionId,
        prompt,
      })
      switch (reply.type) {
        case 'session.claude.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const start = useMutation<
    ClaudeSessionStarted,
    SessionContractError,
    { cwd: string; prompt: string }
  >({
    mutationFn: async ({ cwd, prompt }: { cwd: string; prompt: string }) => {
      const reply = await window.argo.startClaudeSession({
        version: 1,
        type: 'session.claude.start',
        requestId: crypto.randomUUID(),
        cwd,
        prompt,
      })
      switch (reply.type) {
        case 'session.claude.started':
          return reply
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })

  return { interrupt, send, start }
}
