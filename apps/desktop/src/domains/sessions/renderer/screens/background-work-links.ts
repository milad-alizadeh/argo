import type { BackgroundWorkLinks } from '../feed/rows/background-work'
import type { SessionScreenModel } from './use-session-screen-model'

export function backgroundWorkLinks(
  model: Pick<
    SessionScreenModel,
    'pick' | 'selectedSessionId' | 'session' | 'subagents' | 'subagentUsage'
  >,
): BackgroundWorkLinks {
  const { pick, selectedSessionId, session } = model
  return {
    find: (id) => {
      const command = session?.shell.find((entry) => entry.id === id)
      if (command !== undefined) return { kind: 'shell', command }
      const delegation = model.subagents.find((entry) => entry.id === id)
      if (delegation === undefined) return null
      const usage = model.subagentUsage[delegation.id] ?? { tokens: null, model: null }
      return { kind: 'delegation', delegation, usage }
    },
    open: (target) =>
      pick(
        target.kind === 'shell'
          ? { sessionId: selectedSessionId, subagentId: null, shellId: target.command.id }
          : { sessionId: selectedSessionId, subagentId: target.delegation.id, shellId: null },
      ),
  }
}
