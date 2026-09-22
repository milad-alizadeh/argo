import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive'
import { type Send, useSessionComposerState } from './hooks'
import type { TurnSetupControlProps } from './toolbar'

type ComposerOptions = {
  identity: string
  isRunning: boolean
  send: Send
  steer?: (text: string, attachments: SessionAttachmentInput[]) => Promise<boolean>
  setup: TurnSetupControlProps | null
}

// The Composer is the sole component-facing interface for unsent Turn state.
export function useComposer({ identity, isRunning, send, steer, setup }: ComposerOptions) {
  return useSessionComposerState({
    isRunning,
    onSend: send,
    onSteer: steer,
    sessionId: identity,
    setup,
  })
}
