import type { ClaudeSdkMessage } from './types'

export function recoveringState(
  messageParams: ({ event }: { event: { message: ClaudeSdkMessage } }) => {
    message: ClaudeSdkMessage
  },
) {
  return {
    after: { recoveryTimeout: { target: 'Releasing', actions: 'markWatched' } },
    on: {
      'SDK message': [
        {
          guard: { type: 'isInheritedApiCredential', params: messageParams },
          target: 'Releasing',
          actions: 'releaseAsUnavailable',
        },
        { guard: { type: 'isSubscriptionAuthorized', params: messageParams }, target: 'Managed' },
      ],
      'SDK failed': { target: 'Releasing', actions: 'markWatched' },
    },
  } as const
}
