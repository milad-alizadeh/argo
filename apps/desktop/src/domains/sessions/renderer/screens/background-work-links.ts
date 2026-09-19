import type { BackgroundWorkLinks } from '@/domains/sessions/renderer/feed/background-work'
import type { SessionScreenModel } from '@/domains/sessions/renderer/screens/use-session-screen-model'

export function backgroundWorkLinks(model: SessionScreenModel): BackgroundWorkLinks {
  const { pick, selectedSessionId, session } = model
  return {
    find: ({ callId, name }) => {
      const command = session?.shell.find((entry) => entry.id === callId)
      if (command !== undefined) return { kind: 'shell', command }
      const delegation =
        session?.delegations.find((entry) => entry.id === callId) ??
        session?.delegations.findLast((entry) => name !== null && entry.label === name)
      if (delegation === undefined) return null
      const usage = model.delegationUsage[delegation.id] ?? { tokens: null, model: null }
      return { kind: 'delegation', delegation, usage }
    },
    open: (target) =>
      pick(
        target.kind === 'shell'
          ? { sessionId: selectedSessionId, delegationId: null, shellId: target.command.id }
          : { sessionId: selectedSessionId, delegationId: target.delegation.id, shellId: null },
      ),
  }
}
