import type { useSessionMutations } from '../hooks/use-session-mutations'
import { afterRosterPaint } from './after-roster-paint'
import type { TurnInput } from './send-turn'

export function sendInitialClaudeTurn(
  send: ReturnType<typeof useSessionMutations>['send'],
  { prompt, setup, attachments }: TurnInput,
) {
  return async (sessionId: string) => {
    await afterRosterPaint()
    await send.mutateAsync({ sessionId, prompt, setup, attachments })
  }
}
