import type { ClaudeSdkMessage } from './types'

export function recoveringState(
  messageParams: ({ event }: { event: { message: ClaudeSdkMessage } }) => {
    message: ClaudeSdkMessage
  },
) {
  return {
    after: { recoveryTimeout: { target: 'Closing', actions: 'markWatched' } },
    on: {
      'SDK message': [
        {
          guard: { type: 'isInheritedApiCredential', params: messageParams },
          target: 'Closing',
          actions: 'closeAsUnavailable',
        },
        { guard: { type: 'isSubscriptionAuthorized', params: messageParams }, target: 'Managed' },
      ],
      'SDK failed': { target: 'Closing', actions: 'markWatched' },
    },
  } as const
}
