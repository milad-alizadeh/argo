import type { TurnSetupControlProps } from '@/domains/sessions/renderer/composer/run-setup-menu'
import type { Send } from '@/domains/sessions/renderer/composer/use-send'
import { useSessionComposerState } from '@/domains/sessions/renderer/composer/use-session-composer-state'

type ComposerOptions = {
  identity: string
  isRunning: boolean
  send: Send
  setup: TurnSetupControlProps | null
}

// The Composer is the sole component-facing interface for unsent Turn state.
export function useComposer({ identity, isRunning, send, setup }: ComposerOptions) {
  return useSessionComposerState({ isRunning, onSend: send, sessionId: identity, setup })
}
