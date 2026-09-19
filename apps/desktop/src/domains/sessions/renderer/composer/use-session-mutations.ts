import { useMutation } from '@tanstack/react-query'

import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import type { SessionAcceptedReply, SessionStarted } from '@/domains/sessions/contract/contract'
import type { SessionCli } from '@/domains/sessions/renderer/harness/harnesses'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '@/domains/sessions/renderer/session-contract-error'
import type { TurnSetup } from '@/domains/sessions/renderer/turn-setup/turn-setup'

type Turn = { prompt: string; setup: TurnSetup | null; attachments: SessionAttachmentInput[] }

function acceptedOrThrow(reply: SessionAcceptedReply) {
  switch (reply.type) {
    case 'session.accepted':
      return
    case 'session.error':
      return throwSessionContractError(reply)
    default:
      return throwUnexpectedSessionReply(reply)
  }
}

// A `sessionId`-only IPC call that answers with `session.accepted`: compact, handoff and
// interrupt all take this shape, so they share one mutation body.
function useAcceptedMutation(call: (sessionId: string) => Promise<SessionAcceptedReply>) {
  return useMutation<void, SessionContractError, string>({
    mutationFn: async (sessionId: string) => {
      const reply = await call(sessionId)
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
}

// One mutation hook for every CLI (#2030): each adapter validates its own Turn-setup shape at
// its own boundary, so this hook passes `setup` through rather than choosing a schema for it.
export function useSessionMutations() {
  const compact = useAcceptedMutation((sessionId) => window.argo.compactSession({ sessionId }))
  const handoff = useAcceptedMutation((sessionId) => window.argo.handoffSession({ sessionId }))
  const interrupt = useAcceptedMutation((sessionId) => window.argo.interruptSession({ sessionId }))
  const send = useMutation<void, SessionContractError, Turn & { sessionId: string }>({
    mutationFn: async ({ prompt, sessionId, setup, attachments }) =>
      acceptedOrThrow(
        await window.argo.sendSession({
          sessionId,
          prompt,
          setup: setup ?? undefined,
          attachments,
        }),
      ),
  })
  const start = useMutation<
    SessionStarted,
    SessionContractError,
    Turn & { cli: SessionCli; cwd: string }
  >({
    mutationFn: async ({ cli, cwd, prompt, setup, attachments }) => {
      const reply = await window.argo.startSession({
        cli,
        cwd,
        prompt,
        setup: setup ?? undefined,
        attachments,
      })
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

  return { compact, handoff, interrupt, send, start }
}
