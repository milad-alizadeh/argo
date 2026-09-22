import type { BackgroundWorkLinks } from '@/domains/sessions/renderer/feed/rows/background-work'
import type { SessionScreenModel } from '@/domains/sessions/renderer/screens/use-session-screen-model'

export function backgroundWorkLinks(model: SessionScreenModel): BackgroundWorkLinks {
  const { pick, selectedSessionId, session } = model
  return {
    find: ({ callId, name }) => {
      const command = session?.shell.find((entry) => entry.id === callId)
      if (command !== undefined) return { kind: 'shell', command }
      // A realtime delegation's envelope names no call, only the name the agent was sent with.
      const delegation =
        session?.subagents.find((entry) => entry.id === callId) ??
        session?.subagents.findLast((entry) => name !== null && entry.label === name)
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
