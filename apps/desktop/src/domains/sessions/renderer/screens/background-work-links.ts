import type { BackgroundWorkLinks } from '../feed/rows/background-work'
import type { SessionScreenModel } from './use-session-screen-model'

// A row opens the Shell with its id, or else the Subagent with its id; the inspector shows an
// empty state when that Subagent has no transcript.
export function backgroundWorkLinks(
  model: Pick<SessionScreenModel, 'pick' | 'selectedSessionId' | 'session'>,
): BackgroundWorkLinks {
  const { pick, selectedSessionId, session } = model
  return {
    open: (id) =>
      pick(
        session?.shell.some((command) => command.id === id) === true
          ? { sessionId: selectedSessionId, subagentId: null, shellId: id }
          : { sessionId: selectedSessionId, subagentId: id, shellId: null },
      ),
  }
}
