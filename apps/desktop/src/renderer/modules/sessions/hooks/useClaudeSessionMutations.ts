import { useMutation } from '@tanstack/react-query'

import { type ClaudeSessionStarted, claudeTurnSetupSchema } from '@/core/sessions/contract'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '../session-contract-error'
import type { TurnSetup } from '../turn-setup/turn-setup'

type ClaudeTurn = { prompt: string; setup: TurnSetup | null }

function claudeSetup(setup: TurnSetup | null) {
  const parsed = claudeTurnSetupSchema.safeParse(setup)
  if (!parsed.success) throw new Error('Choose a Model, Effort and Mode Claude Code supports.')
  return parsed.data
}

function useCompact() {
  return useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await window.argo.compactClaudeSession({ sessionId })
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
}

export function useClaudeSessionMutations() {
  const compact = useCompact()
  const interrupt = useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await window.argo.interruptClaudeSession({
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
  const send = useMutation<void, SessionContractError, ClaudeTurn & { sessionId: string }>({
    mutationFn: async ({ prompt, sessionId, setup }) => {
      const reply = await window.argo.sendClaudeSession({
        sessionId,
        prompt,
        setup: claudeSetup(setup),
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
    ClaudeTurn & { cwd: string }
  >({
    mutationFn: async ({ cwd, prompt, setup }) => {
      const reply = await window.argo.startClaudeSession({
        cwd,
        prompt,
        setup: claudeSetup(setup),
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

  return { compact, interrupt, send, start }
}
