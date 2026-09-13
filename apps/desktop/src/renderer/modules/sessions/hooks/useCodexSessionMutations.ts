import { useMutation } from '@tanstack/react-query'

import type { CodexSessionStarted } from '@/core/sessions/contract'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'

export function useCodexSessionMutations() {
  const interrupt = useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await window.argo.interruptCodexSession({
        sessionId,
      })
      switch (reply.type) {
        case 'session.codex.accepted':
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
      const reply = await window.argo.sendCodexSession({
        sessionId,
        prompt,
      })
      switch (reply.type) {
        case 'session.codex.accepted':
          return
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  })
  const start = useMutation<CodexSessionStarted, SessionContractError, { cwd: string; prompt: string }>(
    {
      mutationFn: async ({ cwd, prompt }: { cwd: string; prompt: string }) => {
        const reply = await window.argo.startCodexSession({
          cwd,
          prompt,
        })
        switch (reply.type) {
          case 'session.codex.started':
            return reply
          case 'session.error':
            return throwSessionContractError(reply)
          default:
            return throwUnexpectedSessionReply(reply)
        }
      },
    },
  )

  return { interrupt, send, start }
}
