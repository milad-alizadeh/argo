import { assign, emit, fromPromise, sendTo, setup as xstateSetup } from 'xstate'
import {
  advanceFeedActivity,
  EMPTY_FEED_ACTIVITY,
  type FeedActivityState,
  settleFeedActivity,
} from '@/domains/sessions/api/feed-activity'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionLiveInput, SessionStartInput } from '../api/session-submit'
import { liveSessionChannelActor } from './live-session-channel-actor'

type DrivenSessionInput = SessionLiveInput
type LiveSessionStatus = Extract<
  SessionLiveEventBody,
  {
    type: 'status'
  }
>['status']

export type QueuedLiveSessionCommand = Pick<
  SessionStartInput,
  'commandId' | 'prompt' | 'attachments' | 'turnConfiguration'
>
type LiveSessionPersistInput = {
  harness: string
  projectId: string | null
  workspaceId: string | null
  cwd: string
  nativeId: string | null
  firstPrompt: string
  sessionId?: string
}

export const liveSessionMachine = xstateSetup({
  types: {
    input: {} as DrivenSessionInput,
    context: {} as {
      argoId: string | null
      first: DrivenSessionInput
      nativeId: string | null
      queue: QueuedLiveSessionCommand[]
      seenCommandIds: string[]
      failure: string | null
      harnessReady: boolean
      feedSerial: number
      status: LiveSessionStatus | null
      activity: FeedActivityState
    },
    events: {} as
      | {
          type: 'Send'
          command: QueuedLiveSessionCommand
        }
      | {
          type: 'Close'
        }
      | {
          type: 'Interrupt'
          reply: {
            resolve: () => void
            reject: (error: Error) => void
          }
        }
      | {
          type: 'Answer permission'
          requestId: string
          decision: PermissionDecision
          reply: {
            resolve: (accepted: boolean) => void
            reject: (error: Error) => void
          }
        }
      | {
          type: 'Answer question'
          requestId: string
          answers: QuestionAnswer[]
          reply: {
            resolve: (accepted: boolean) => void
            reject: (error: Error) => void
          }
        }
      | {
          type: 'Harness identified'
          nativeId: string
        }
      | {
          type: 'Harness ready'
          nativeId: string
        }
      | {
          type: 'Harness failed'
          failure: string
        }
      | {
          type: 'Harness feed'
          serial: number
          body: SessionLiveEventBody
        }
      | {
          type: 'xstate.done.actor.persist'
          output: string
        }
      | {
          type: 'xstate.error.actor.persist'
          error: unknown
        },
    emitted: {} as {
      type: 'feed'
      body: SessionLiveEventBody
    },
  },
  actors: {
    harness: liveSessionChannelActor(() => {
      throw new Error('Live Session channel was not provided.')
    }, undefined),
    persist: fromPromise<string, LiveSessionPersistInput>(async () => {
      throw new Error('Session persistence actor was not provided.')
    }),
  },
  actions: {
    queueDistinct: assign(({ context, event }) =>
      event.type === 'Send' && !context.seenCommandIds.includes(event.command.commandId)
        ? {
            queue: [
              ...context.queue,
              event.command,
            ],
            seenCommandIds: [
              ...context.seenCommandIds,
              event.command.commandId,
            ],
          }
        : {},
    ),
    dequeue: assign({
      queue: ({ context }) => context.queue.slice(1),
    }),
    rememberArgoId: assign({
      argoId: ({ context, event }) =>
        'output' in event && typeof event.output === 'string' ? event.output : context.argoId,
    }),
    rememberNativeId: assign({
      nativeId: ({ context, event }) =>
        event.type === 'Harness ready' || event.type === 'Harness identified'
          ? event.nativeId
          : context.nativeId,
    }),
    rememberHarnessFailure: assign({
      failure: ({ context, event }) =>
        event.type === 'Harness failed' ? event.failure : context.failure,
    }),
    rememberFeedSerial: assign({
      feedSerial: ({ context, event }) =>
        event.type === 'Harness feed' ? event.serial : context.feedSerial,
    }),
    rememberStatus: assign({
      status: ({ context, event }) =>
        event.type === 'Harness feed' && event.body.type === 'status'
          ? event.body.status
          : context.status,
    }),
    rememberActivity: assign({
      activity: ({ context, event }) => {
        if (event.type !== 'Harness feed') return context.activity
        if (event.body.type === 'content')
          return advanceFeedActivity(context.activity, event.body.content)
        if (event.body.type === 'status' && event.body.status === 'idle')
          return settleFeedActivity(context.activity)
        return context.activity
      },
    }),
    rememberHarnessReady: assign({
      harnessReady: true,
    }),
    rememberPersistFailure: assign({
      failure: ({ context, event }) => ('error' in event ? String(event.error) : context.failure),
    }),
    sendQueuedCommand: sendTo('harness', ({ context }) => ({
      type: 'Send',
      command: context.queue[0],
    })),
    interrupt: sendTo('harness', ({ event }) => {
      if (event.type !== 'Interrupt') throw new Error('Expected a Session interrupt.')
      return {
        type: 'Interrupt',
        reply: event.reply,
      }
    }),
    answerPermission: sendTo('harness', ({ event }) => {
      if (event.type !== 'Answer permission') throw new Error('Expected a Permission answer.')
      return event
    }),
    answerQuestion: sendTo('harness', ({ event }) => {
      if (event.type !== 'Answer question') throw new Error('Expected a Question answer.')
      return event
    }),
  },
  guards: {
    hasQueuedCommand: ({ context }) => context.queue.length > 0,
    harnessIsReady: ({ context }) => context.harnessReady,
    isNewCommand: ({ context, event }) =>
      event.type === 'Send' && !context.seenCommandIds.includes(event.command.commandId),
  },
}).createMachine({
  id: 'liveSession',
  initial: 'Starting',
  context: ({ input }) => ({
    argoId: null,
    first: input,
    nativeId: null,
    queue: [],
    seenCommandIds: [
      input.commandId,
    ],
    failure: null,
    harnessReady: false,
    feedSerial: 0,
    status: null,
    activity: EMPTY_FEED_ACTIVITY,
  }),
  invoke: {
    id: 'harness',
    src: 'harness',
    input: ({ context }) => context.first,
  },
  states: {
    Starting: {
      on: {
        'Harness identified': {
          target: 'Persisting',
          actions: 'rememberNativeId',
        },
        'Harness ready': {
          target: 'Persisting',
          actions: [
            'rememberNativeId',
            'rememberHarnessReady',
          ],
        },
        'Harness failed': {
          target: 'Failed',
          actions: 'rememberHarnessFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    Persisting: {
      invoke: {
        id: 'persist',
        src: 'persist',
        input: ({ context }) => ({
          harness: 'resume' in context.first ? context.first.resume.harness : context.first.harness,
          projectId:
            'resume' in context.first ? context.first.resume.projectId : context.first.projectId,
          workspaceId:
            'resume' in context.first
              ? context.first.resume.workspaceId
              : context.first.workspaceId,
          cwd: 'resume' in context.first ? context.first.resume.cwd : context.first.cwd,
          nativeId: context.nativeId,
          firstPrompt: context.first.prompt,
          ...('resume' in context.first
            ? {
                sessionId: context.first.sessionId,
              }
            : {}),
        }),
        onDone: {
          actions: 'rememberArgoId',
          target: 'Awaiting turn',
        },
        onError: {
          target: 'Failed',
          actions: 'rememberPersistFailure',
        },
      },
      on: {
        'Harness ready': {
          actions: 'rememberHarnessReady',
        },
        'Harness failed': {
          target: 'Failed',
          actions: 'rememberHarnessFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    'Awaiting turn': {
      always: {
        guard: 'harnessIsReady',
        target: 'Draining',
      },
      on: {
        'Harness ready': {
          target: 'Draining',
          actions: 'rememberHarnessReady',
        },
        'Harness failed': {
          target: 'Failed',
          actions: 'rememberHarnessFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    Draining: {
      always: [
        {
          guard: 'hasQueuedCommand',
          target: 'Sending',
        },
        {
          target: 'Ready',
        },
      ],
      on: {
        'Harness failed': {
          target: 'Failed',
          actions: 'rememberHarnessFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    Sending: {
      entry: 'sendQueuedCommand',
      on: {
        'Harness ready': {
          target: 'Draining',
          actions: 'dequeue',
        },
        'Harness failed': {
          target: 'Failed',
          actions: 'rememberHarnessFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    Ready: {
      on: {
        Send: {
          target: 'Draining',
          guard: 'isNewCommand',
          actions: 'queueDistinct',
        },
        'Harness failed': {
          target: 'Failed',
          actions: 'rememberHarnessFailure',
        },
        Close: 'Closed',
      },
    },
    Failed: {
      on: {
        Close: 'Closed',
      },
    },
    Closed: {
      type: 'final',
    },
  },
  on: {
    'Harness feed': {
      actions: [
        'rememberFeedSerial',
        'rememberStatus',
        'rememberActivity',
        emit(({ event }) => {
          if (event.type !== 'Harness feed') throw new Error('Expected a Harness Feed event.')
          return {
            type: 'feed',
            body: event.body,
          }
        }),
      ],
    },
    Interrupt: {
      actions: 'interrupt',
    },
    'Answer permission': {
      actions: 'answerPermission',
    },
    'Answer question': {
      actions: 'answerQuestion',
    },
  },
})
