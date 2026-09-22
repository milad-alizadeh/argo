import type { ClaudeSessionContext, ClaudeSessionInput } from '@/harnesses/claude/agent-sdk/types'

export function leaseStates(input: ClaudeSessionInput) {
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
