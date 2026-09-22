import { assign, fromPromise, sendTo, setup } from 'xstate'
import { appendAssistantMessage } from '@/harnesses/claude/agent-sdk/claude-live-messages'
import { claudeQueryLogic } from '@/harnesses/claude/agent-sdk/claude-query-actor'
import {
  initialClaudeSessionContext,
  sessionFrom,
} from '@/harnesses/claude/agent-sdk/claude-session-context'
import { leaseStates } from '@/harnesses/claude/agent-sdk/claude-session-lease-states'
import { recoveringState } from '@/harnesses/claude/agent-sdk/claude-session-recovery'
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
    isSubscriptionAuthorized: (_, params: { message: ClaudeSdkMessage }) =>
      isSubscriptionAuthorized(params.message),
    isInheritedApiCredential: (_, params: { message: ClaudeSdkMessage }) =>
      isInheritedApiCredential(params.message),
    isAuthenticationFailure: (_, params: { message: ClaudeSdkMessage }) =>
      isAuthenticationFailure(params.message),
  },
  actions: {
    markUnavailable: assign({ sourceHealth: 'unavailable' as const }),
    markWatched: assign({ releaseTarget: 'watched' as const }),
    releaseAsUnavailable: assign({ releaseTarget: 'unavailable' as const }),
    recordAssistantMessage: assign(({ context, event }) =>
      event.type === 'SDK message'
        ? { liveMessages: appendAssistantMessage(context.liveMessages, event.message) }
        : {},
    ),
    addApproval: assign(({ context, event }) =>
      event.type === 'Approval requested'
        ? { pendingApprovals: [...context.pendingApprovals, event.approval] }
        : {},
    ),
    removeApproval: assign(({ context, event }) =>
      event.type === 'Decide'
        ? { pendingApprovals: context.pendingApprovals.filter(({ id }) => id !== event.approvalId) }
        : {},
    ),
    addQuestion: assign(({ context, event }) =>
      event.type === 'Question requested'
        ? { pendingQuestions: [...context.pendingQuestions, event.question] }
        : {},
    ),
    removeQuestion: assign(({ context, event }) =>
      event.type === 'Answer'
        ? { pendingQuestions: context.pendingQuestions.filter(({ id }) => id !== event.questionId) }
        : {},
    ),
  },
  delays: {
    recoveryTimeout: 60_000,
  },
})

export function createClaudeSessionMachine(input: ClaudeSessionInput) {
  return claudeSessionSetup.createMachine({
    id: 'claudeManagedSession',
    context: () => initialClaudeSessionContext(input),
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
          Decide: { actions: ['removeApproval', sendTo('claudeQuery', ({ event }) => event)] },
          Answer: { actions: ['removeQuestion', sendTo('claudeQuery', ({ event }) => event)] },
          'Approval requested': { actions: 'addApproval' },
          'Question requested': { actions: 'addQuestion' },
          Rename: { actions: sendTo('claudeQuery', ({ event }) => event) },
          'SDK message': [
            {
              guard: { type: 'isAuthenticationFailure', params: messageParams },
              target: 'Releasing',
              actions: assign({ releaseTarget: 'unavailable' }),
            },
            { actions: 'recordAssistantMessage' },
          ],
          'Channel lost': 'Recovering',
          'SDK failed': 'Releasing',
          'SDK ended': 'Releasing',
          Close: 'Releasing',
        },
      },
      Recovering: recoveringState(messageParams),
      Unavailable: { type: 'final', entry: 'markUnavailable' },
      Watched: { type: 'final' },
      Closed: { type: 'final' },
    },
  })
}
