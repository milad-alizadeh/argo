import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { assign, sendTo, setup } from 'xstate'
import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import { claudeQueryLogic } from '@/harnesses/claude/agent-sdk/claude-query-actor'
import {
  isAuthenticationFailure,
  isInheritedApiCredential,
  isSubscriptionAuthorized,
} from '@/harnesses/claude/agent-sdk/subscription-authorization'
import type {
  ClaudeSessionContext,
  ClaudeSessionEvent,
  ClaudeSessionInput,
} from '@/harnesses/claude/agent-sdk/types'

export type { ClaudeQueryFactory, ClaudeSessionInput } from '@/harnesses/claude/agent-sdk/types'

const messageParams = ({ event }: { event: { message: SDKMessage } }) => ({
  message: event.message,
})

const claudeSessionSetup = setup({
  types: {
    context: {} as ClaudeSessionContext,
    input: {} as { session: SessionIdentity },
    events: {} as ClaudeSessionEvent,
  },
  actors: { claudeQuery: claudeQueryLogic },
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
  },
})

export function createClaudeSessionMachine(input: ClaudeSessionInput) {
  return claudeSessionSetup.createMachine({
    id: 'claudeManagedSession',
    context: ({ input: machineInput }) => ({
      session: machineInput.session,
      sourceHealth: 'ready',
    }),
    invoke: { id: 'claudeQuery', src: 'claudeQuery', input: () => input },
    initial: 'Authorizing',
    states: {
      Authorizing: {
        on: {
          'SDK message': [
            {
              guard: { type: 'isInheritedApiCredential', params: messageParams },
              target: 'Unavailable',
            },
            {
              guard: { type: 'isSubscriptionAuthorized', params: messageParams },
              target: 'Managed',
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
            target: 'Unavailable',
          },
          'SDK failed': 'Unavailable',
          'SDK ended': 'Closed',
        },
      },
      Unavailable: { type: 'final', entry: 'markUnavailable' },
      Closed: { type: 'final' },
    },
  })
}
