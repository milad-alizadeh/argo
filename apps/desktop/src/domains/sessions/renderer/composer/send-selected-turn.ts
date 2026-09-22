import type { useQueryClient } from '@tanstack/react-query'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import { sendMessage } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import { invalidateSessionRoster } from '@/domains/sessions/renderer/session-queries'
import type { TurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/turn-setup'
import type { useTurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/use-turn-setup'

export function sendToSelected(request: {
  queryClient: ReturnType<typeof useQueryClient>
  since: string | null
  selectedSessionId: string
  send: ReturnType<typeof useSessionMutations>['send']
  setFailure: (failure: Failure | null) => void
  turn: { prompt: string; setup: TurnSetup | null; attachments: SessionAttachmentInput[] }
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}) {
  const { queryClient, since, selectedSessionId, send, setFailure, turn, watchTurn } = request
  const { prompt, setup, attachments } = turn
  return sendMessage(
    { send, prompt, setup, attachments, sessionId: selectedSessionId, setFailure },
    () => {
      if (setup !== null) watchTurn(selectedSessionId, setup, since)
      return invalidateSessionRoster(queryClient)
    },
  )
}
