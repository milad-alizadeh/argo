import type { useQueryClient } from '@tanstack/react-query'
import type { SessionCommandOutcome } from '@/domains/sessions/next/contract/session-projection-contract'
import type { TurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/turn-setup'
import type { useTurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/use-turn-setup'
import type { SendOutcome } from '@/domains/sessions/renderer/composer/use-send'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import { invalidateSessionRoster } from '@/domains/sessions/renderer/session-queries'

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
