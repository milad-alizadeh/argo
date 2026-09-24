import { assign, sendTo, setup } from 'xstate'
import { appendAssistantMessage } from './claude-live-messages'
import { claudeQueryLogic } from './claude-query-actor'
import { channelStates } from './claude-session-channel-states'
import { initialClaudeSessionContext, sessionFrom } from './claude-session-context'
import { claudeSessionGuards } from './claude-session-guards'
import { recoveringState } from './claude-session-recovery'
import type {
  ClaudeSdkMessage,
  ClaudeSessionContext,
  ClaudeSessionEvent,
  ClaudeSessionInput,
} from './types'

export type { ClaudeQueryFactory, ClaudeSessionInput } from './types'

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
  },
  guards: claudeSessionGuards,
  actions: {
    startInitialTurn: sendTo('claudeQuery', ({ context }) => ({
      type: 'Send',
      prompt: context.prompt,
    })),
    markUnavailable: assign({ sourceHealth: 'unavailable' as const }),
    markWatched: assign({ closingTarget: 'watched' as const }),
    closeAsUnavailable: assign({ closingTarget: 'unavailable' as const }),
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
  delays: { recoveryTimeout: 60_000 },
})

export function createClaudeSessionMachine(input: ClaudeSessionInput) {
  return claudeSessionSetup.createMachine({
    id: 'claudeManagedSession',
    context: () => initialClaudeSessionContext(input),
    invoke: { id: 'claudeQuery', src: 'claudeQuery', input: () => input },
    initial: 'Authorizing',
    states: {
      ...channelStates(input),
      Authorizing: {
        on: {
          'SDK message': [
            {
              guard: { type: 'isInheritedApiCredential', params: messageParams },
              target: 'Unavailable',
            },
            {
              guard: { type: 'isSubscriptionAuthorized', params: messageParams },
              target: 'Opening',
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
          'SDK ended': 'Unavailable',
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
              target: 'Closing',
              actions: assign({ closingTarget: 'unavailable' }),
            },
            { actions: 'recordAssistantMessage' },
          ],
          'Channel lost': 'Recovering',
          'SDK failed': 'Closing',
          'SDK ended': 'Closing',
          Close: 'Closing',
        },
      },
      Recovering: recoveringState(messageParams),
      Unavailable: { type: 'final', entry: 'markUnavailable' },
      Watched: { type: 'final' },
      Closed: { type: 'final' },
    },
  })
}
