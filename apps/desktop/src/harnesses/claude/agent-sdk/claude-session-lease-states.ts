import type { ClaudeSessionContext, ClaudeSessionInput } from './types'

export function leaseStates(input: ClaudeSessionInput) {
  const initialTurn =
    input.session === null && input.startTurn !== false ? 'startInitialTurn' : undefined
  const releaseTargets = [
    {
      guard: ({ context }: { context: ClaudeSessionContext }) => context.releaseTarget === 'closed',
      target: 'Closed',
    },
    {
      guard: ({ context }: { context: ClaudeSessionContext }) =>
        context.releaseTarget === 'unavailable',
      target: 'Unavailable',
    },
    { target: 'Watched' },
  ] as const
  return {
    AcquiringLease: {
      on: {
        'Approval requested': { actions: 'addApproval' },
        'Question requested': { actions: 'addQuestion' },
      },
      invoke: {
        src: 'acquireLease',
        input: ({ context }: { context: ClaudeSessionContext }) => ({
          ...input,
          session: context.session,
        }),
        onDone: [
          {
            guard: ({ event }: { event: { output: { posture: string } } }) =>
              event.output.posture === 'managed',
            target: 'Managed',
            actions: initialTurn,
          },
          { target: 'Watched' },
        ],
        onError: 'Unavailable',
      },
    },
    Releasing: {
      invoke: {
        src: 'releaseLease',
        input: ({ context }: { context: ClaudeSessionContext }) => ({
          ...input,
          session: context.session,
        }),
        onDone: releaseTargets,
        onError: releaseTargets,
      },
    },
  } as const
}
