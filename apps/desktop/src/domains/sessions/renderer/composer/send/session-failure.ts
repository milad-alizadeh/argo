import type { SessionErrorCode } from '@/domains/sessions/contract/ipc'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive'
import { SessionContractError } from '../../session-contract-error'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { useSessionMutations } from '../hooks'

// A failure belongs to the Session it happened on, so selecting another Session does not show it.
export type Failure = { sessionId: string | null; message: string; code: SessionErrorCode | null }

export function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function codeFrom(error: unknown): SessionErrorCode | null {
  return error instanceof SessionContractError ? error.code : null
}

export async function sendMessage(
  request: {
    send: ReturnType<typeof useSessionMutations>['send']
    prompt: string
    setup: TurnSetup | null
    attachments: SessionAttachmentInput[]
    sessionId: string
    setFailure: (failure: Failure | null) => void
  },
  afterSend: () => Promise<void>,
) {
  const { send, prompt, setup, attachments, sessionId, setFailure } = request
  try {
    await send.mutateAsync({ prompt, sessionId, setup, attachments })
    setFailure(null)
  } catch (error) {
    setFailure({
      sessionId,
      message: messageFrom(error, 'Argo could not send this message.'),
      code: codeFrom(error),
    })
    return false
  }
  await afterSend()
  return true
}
