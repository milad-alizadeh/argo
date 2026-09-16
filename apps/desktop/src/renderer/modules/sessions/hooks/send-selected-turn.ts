import type { useQueryClient } from '@tanstack/react-query'
import type { SessionAttachmentInput } from '@/core/sessions/attachments-contract'
import { invalidateSessionRoster } from '../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { useTurnSetup } from '../turn-setup/use-turn-setup'
import type { Failure } from './use-session-composer-actions'
import { sendMessage } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'

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
