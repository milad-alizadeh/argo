import type { useTurnSetup } from '../turn-setup'
import type { SessionHarness } from '../../harness'
import type { useQueryClient } from '@tanstack/react-query'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import { invalidateSessionRoster } from '../../session-queries'
import type { TurnSetup } from '../turn-setup/turn-setup'
import type { SendOutcome } from '../hooks'
import type { Failure } from './session-failure'

export async function sendManagedSessionTurn(options: {
  deps: {
    queryClient: ReturnType<typeof useQueryClient>
    setFailure: (failure: Failure | null) => void
    watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
    sendManagedSession: (
      harness: SessionHarness,
      sessionId: string,
      prompt: string,
    ) => Promise<SessionCommandOutcome>
  }
  harness: SessionHarness
  sessionId: string
  since: string | null
  turn: { prompt: string; setup: TurnSetup | null }
}): Promise<SendOutcome> {
  const { deps, harness, sessionId, since, turn } = options
  const outcome = await deps.sendManagedSession(harness, sessionId, turn.prompt)
  switch (outcome.kind) {
    case 'accepted':
      if (turn.setup !== null) deps.watchTurn(sessionId, turn.setup, since)
      await invalidateSessionRoster(deps.queryClient)
      deps.setFailure(null)
      return 'accepted'
    case 'rejected':
      deps.setFailure({ sessionId, message: outcome.reason, code: null })
      return 'rejected'
    case 'uncertain':
      return 'uncertain'
  }
}
