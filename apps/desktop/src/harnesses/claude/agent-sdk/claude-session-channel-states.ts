import type { ClaudeSessionContext, ClaudeSessionInput } from './types'

export function channelStates(input: ClaudeSessionInput) {
  const initialTurn =
    input.session === null && input.startTurn !== false ? 'startInitialTurn' : undefined
  const closeTargets = [
    {
      guard: ({ context }: { context: ClaudeSessionContext }) => context.closingTarget === 'closed',
      target: 'Closed',
    },
    {
      guard: ({ context }: { context: ClaudeSessionContext }) =>
        context.closingTarget === 'unavailable',
      target: 'Unavailable',
    },
    { target: 'Watched' },
  ] as const
  return {
    Opening: {
      always: { target: 'Managed', actions: initialTurn },
    },
    Closing: {
      always: closeTargets,
    },
  } as const
}
