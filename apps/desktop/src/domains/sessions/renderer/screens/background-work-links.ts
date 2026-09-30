import type { BackgroundWorkLinks } from '../feed'
import type { SessionScreenModel } from './use-session-screen-model'

// A row opens the Subagent it names by id; the inspector shows an empty state when that Subagent
// has no transcript.
export function backgroundWorkLinks(
  model: Pick<SessionScreenModel, 'pick' | 'selectedSessionId'>,
): BackgroundWorkLinks {
  const { pick, selectedSessionId } = model
  return {
    open: (subagent) =>
      pick({
        sessionId: selectedSessionId,
        subagentId: subagent.id,
        shellId: null,
        opened: subagent,
      }),
  }
}
