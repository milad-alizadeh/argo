import { assign, fromPromise, sendTo, setup } from 'xstate'
import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import { claudeQueryLogic } from '@/harnesses/claude/agent-sdk/claude-query-actor'
import { leaseStates } from '@/harnesses/claude/agent-sdk/claude-session-lease-states'
import {
  isAuthenticationFailure,
  isInheritedApiCredential,
  isSubscriptionAuthorized,
} from '@/harnesses/claude/agent-sdk/subscription-authorization'
import type {
  ClaudeSdkMessage,
  ClaudeSessionContext,
  ClaudeSessionEvent,
  ClaudeSessionInput,
} from '@/harnesses/claude/agent-sdk/types'

export type { ClaudeQueryFactory, ClaudeSessionInput } from '@/harnesses/claude/agent-sdk/types'

const messageParams = ({ event }: { event: { message: ClaudeSdkMessage } }) => ({
  message: event.message,
})

function initialContext(input: ClaudeSessionInput): ClaudeSessionContext {
  return {
    session: input.session,
    workspaceId: input.workspaceId,
    sourceHealth: 'ready',
    releaseTarget: 'closed',
  }
}

function sessionFrom(message: ClaudeSdkMessage): SessionIdentity | null {
  if (message.type !== 'system' || message.subtype !== 'init') return null
  return { harness: 'claude', nativeId: message.session_id }
}

const claudeSessionSetup = setup({
  types: {
    context: {} as ClaudeSessionContext,
    input: {} as never,
    events: {} as ClaudeSessionEvent,
  },
  actors: {
    claudeQuery: claudeQueryLogic,
    acquireLease: fromPromise<
      ReturnType<ClaudeSessionInput['sessionService']['acquire']>,
      ClaudeSessionInput
    >(({ input }) => {
      if (input.session === null) throw new Error('Claude Session has no identity')
      return Promise.resolve(input.sessionService.acquire(input.session))
    }),
    releaseLease: fromPromise<void, ClaudeSessionInput>(({ input }) => {
      if (input.session !== null) input.sessionService.release(input.session)
      return Promise.resolve()
    }),
  },
  guards: {
    isSubscriptionAuthorized: (_, params: { message: SDKMessage }) =>
      isSubscriptionAuthorized(params.message),
    isInheritedApiCredential: (_, params: { message: SDKMessage }) =>
      isInheritedApiCredential(params.message),
    isAuthenticationFailure: (_, params: { message: SDKMessage }) =>
      isAuthenticationFailure(params.message),
  },
  actions: {
    markUnavailable: assign({ sourceHealth: 'unavailable' as const }),
    markWatched: assign({ releaseTarget: 'watched' as const }),
    releaseAsUnavailable: assign({ releaseTarget: 'unavailable' as const }),
  },
  delays: {
    recoveryTimeout: 60_000,
  },
})

function recoveringState() {
  return {
    after: {
      recoveryTimeout: {
        target: 'Releasing',
        actions: 'markWatched',
      },
    },
    on: {
      'SDK message': [
        {
          guard: { type: 'isInheritedApiCredential', params: messageParams },
          target: 'Releasing',
          actions: 'releaseAsUnavailable',
        },
        {
          guard: { type: 'isSubscriptionAuthorized', params: messageParams },
          target: 'Managed',
        },
      ],
      'SDK failed': 'Releasing',
    },
  } as const
}

export function createClaudeSessionMachine(input: ClaudeSessionInput) {
  return claudeSessionSetup.createMachine({
    id: 'claudeManagedSession',
    context: () => initialContext(input),
    invoke: { id: 'claudeQuery', src: 'claudeQuery', input: () => input },
    initial: 'Authorizing',
    states: {
      ...leaseStates(input),
      Authorizing: {
        on: {
          'SDK message': [
            {
              guard: { type: 'isInheritedApiCredential', params: messageParams },
              target: 'Unavailable',
            },
            {
              guard: { type: 'isSubscriptionAuthorized', params: messageParams },
              target: 'AcquiringLease',
              actions: [
                assign({ session: ({ event }) => sessionFrom(event.message) }),
                sendTo('claudeQuery', ({ event }) => {
                  const session = sessionFrom(event.message)
                  if (session === null) throw new Error('Claude Session has no identity')
                  return { type: 'Session identified', session }
                }),
              ],
            },
          ],
          'SDK failed': 'Unavailable',
        },
      },
      Managed: {
        on: {
          Send: { actions: sendTo('claudeQuery', ({ event }) => event) },
          Steer: { actions: sendTo('claudeQuery', ({ event }) => event) },
          Interrupt: { actions: sendTo('claudeQuery', ({ event }) => event) },
          Decide: { actions: sendTo('claudeQuery', ({ event }) => event) },
          Answer: { actions: sendTo('claudeQuery', ({ event }) => event) },
          Rename: { actions: sendTo('claudeQuery', ({ event }) => event) },
          'SDK message': {
            guard: { type: 'isAuthenticationFailure', params: messageParams },
            target: 'Releasing',
            actions: assign({ releaseTarget: 'unavailable' }),
          },
          'Channel lost': 'Recovering',
          'SDK failed': 'Releasing',
          'SDK ended': 'Releasing',
          Close: 'Releasing',
        },
      },
      Recovering: recoveringState(),
      Unavailable: { type: 'final', entry: 'markUnavailable' },
      Watched: { type: 'final' },
      Closed: { type: 'final' },
    },
  })
}
