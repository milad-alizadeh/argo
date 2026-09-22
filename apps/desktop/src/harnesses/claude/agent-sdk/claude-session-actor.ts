import type { Query, SDKMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import { assign, fromCallback, sendTo, setup } from 'xstate'
import type {
  SessionIdentity,
  SourceHealth,
} from '@/domains/sessions/next/contract/session-contract'
import {
  createStreamInputChannel,
  userMessage,
} from '@/harnesses/claude/agent-sdk/stream-input-channel'
import {
  isAuthenticationFailure,
  isInheritedApiCredential,
  isSubscriptionAuthorized,
} from '@/harnesses/claude/agent-sdk/subscription-authorization'

export type ClaudeQueryFactory = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  cwd: string
}) => Query

export type ClaudeSessionInput = {
  session: SessionIdentity
  prompt: string
  cwd: string
  createQuery: ClaudeQueryFactory
}

type ClaudeSessionContext = {
  session: SessionIdentity
  sourceHealth: SourceHealth
}

type ClaudeSessionEvent =
  | { type: 'session.send'; prompt: string }
  | { type: 'session.interrupt' }
  | { type: 'sdk.message'; message: SDKMessage }
  | { type: 'sdk.ended' }
  | { type: 'sdk.failed' }

// The invoked actor owns the SDK query, its process, and the streaming-input channel. Machine
// context never holds them, so a persisted or inspected snapshot carries no live resource.
const claudeQueryLogic = fromCallback<ClaudeSessionEvent, ClaudeSessionInput>(
  ({ input, sendBack, receive }) => {
    const channel = createStreamInputChannel()
    channel.push(userMessage(input.prompt))
    const query = input.createQuery({ prompt: channel.iterable, cwd: input.cwd })
    let stopped = false

    void (async () => {
      try {
        for await (const message of query) {
          if (stopped) return
          sendBack({ type: 'sdk.message', message })
        }
        if (!stopped) sendBack({ type: 'sdk.ended' })
      } catch {
        if (!stopped) sendBack({ type: 'sdk.failed' })
      }
    })()

    receive((event: ClaudeSessionEvent) => {
      if (event.type === 'session.send') channel.push(userMessage(event.prompt))
      if (event.type === 'session.interrupt') void query.interrupt()
    })

    return () => {
      stopped = true
      channel.close()
      query.close()
    }
  },
)

export function createClaudeSessionMachine(input: ClaudeSessionInput) {
  return setup({
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
  }).createMachine({
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
          'sdk.message': [
            {
              guard: {
                type: 'isInheritedApiCredential',
                params: ({ event }) => ({ message: event.message }),
              },
              target: 'Unavailable',
            },
            {
              guard: {
                type: 'isSubscriptionAuthorized',
                params: ({ event }) => ({ message: event.message }),
              },
              target: 'Managed',
            },
          ],
          'sdk.failed': 'Unavailable',
        },
      },
      Managed: {
        on: {
          'session.send': { actions: sendTo('claudeQuery', ({ event }) => event) },
          'session.interrupt': { actions: sendTo('claudeQuery', ({ event }) => event) },
          'sdk.message': {
            guard: {
              type: 'isAuthenticationFailure',
              params: ({ event }) => ({ message: event.message }),
            },
            target: 'Unavailable',
          },
          'sdk.failed': 'Unavailable',
          'sdk.ended': 'Closed',
        },
      },
      Unavailable: { type: 'final', entry: 'markUnavailable' },
      Closed: { type: 'final' },
    },
  })
}
