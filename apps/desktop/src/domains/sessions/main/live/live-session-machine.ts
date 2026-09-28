import {
  assign,
  emit,
  enqueueActions,
  fromPromise,
  type SnapshotFrom,
  sendTo,
  setup as xstateSetup,
} from 'xstate'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { claudeLiveSessionMachine } from '@/harnesses/claude/session/claude-live-session-machine'
import type { codexLiveSessionMachine } from '@/harnesses/codex/session/codex-live-session-machine'
import type { SessionLiveInput, SessionStartInput } from '../api/session-submit'

type DrivenSessionInput = SessionLiveInput

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
      failure: string | null
      harnessReady: boolean
      feedSerial: number
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
        }
      | {
          type: 'xstate.snapshot.harness'
          snapshot: SnapshotFrom<typeof claudeLiveSessionMachine | typeof codexLiveSessionMachine>
        },
    emitted: {} as {
      type: 'feed'
      body: SessionLiveEventBody
    },
  },
  actors: {
    harness: claudeLiveSessionMachine as
      | typeof claudeLiveSessionMachine
      | typeof codexLiveSessionMachine,
    persist: fromPromise<string, LiveSessionPersistInput>(async () => {
      throw new Error('Session persistence actor was not provided.')
    }),
  },
  actions: {
    reportHarnessSnapshot: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'xstate.snapshot.harness') return
      const snapshot = event.snapshot
      if (
        'lastFeed' in snapshot.context &&
        snapshot.context.lastFeed !== null &&
        snapshot.context.lastFeed.serial > context.feedSerial
      )
        enqueue.raise({
          type: 'Harness feed',
          ...snapshot.context.lastFeed,
        })
      if (snapshot.matches('Failed'))
        enqueue.raise({
          type: 'Harness failed',
          failure: snapshot.context.failure ?? 'Harness failed.',
        })
      else if (snapshot.context.nativeId !== null) {
        enqueue.raise({
          type: 'Harness identified',
          nativeId: snapshot.context.nativeId,
        })
        if (snapshot.hasTag('ready'))
          enqueue.raise({
            type: 'Harness ready',
            nativeId: snapshot.context.nativeId,
          })
      }
    }),
    queueDistinct: assign({
      queue: ({ context, event }) =>
        event.type === 'Send' &&
        event.command.commandId !== context.first.commandId &&
        !context.queue.some(({ commandId }) => commandId === event.command.commandId)
          ? [
              ...context.queue,
              event.command,
            ]
          : context.queue,
    }),
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
  },
  guards: {
    hasQueuedCommand: ({ context }) => context.queue.length > 0,
    harnessIsReady: ({ context }) => context.harnessReady,
    isNewCommand: ({ context, event }) =>
      event.type === 'Send' &&
      event.command.commandId !== context.first.commandId &&
      !context.queue.some(({ commandId }) => commandId === event.command.commandId),
  },
}).createMachine({
  id: 'liveSession',
  initial: 'Starting',
  context: ({ input }) => ({
    argoId: null,
    first: input,
    nativeId: null,
    queue: [],
    failure: null,
    harnessReady: false,
    feedSerial: 0,
  }),
  invoke: {
    id: 'harness',
    src: 'harness',
    input: ({ context }) => context.first,
    onSnapshot: {
      actions: 'reportHarnessSnapshot',
    },
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
        emit(({ event }) => {
          if (event.type !== 'Harness feed') throw new Error('Expected a Harness Feed event.')
          return {
            type: 'feed',
            body: event.body,
          }
        }),
      ],
    },
  },
})
