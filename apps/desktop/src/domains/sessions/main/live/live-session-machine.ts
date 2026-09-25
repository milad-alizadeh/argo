import {
  assign,
  enqueueActions,
  fromPromise,
  type SnapshotFrom,
  sendTo,
  setup as xstateSetup,
} from 'xstate'
import { claudeLiveSessionMachine } from '@/harnesses/claude/session/claude-live-session-machine'
import type { codexLiveSessionMachine } from '@/harnesses/codex/session/codex-live-session-machine'
import type { SessionStartInput } from '../api/session-submit'

export type QueuedLiveSessionCommand = Pick<
  SessionStartInput,
  'commandId' | 'prompt' | 'attachments' | 'turnConfiguration'
>
type LiveSessionPersistInput = {
  harness: string
  projectId: string
  workspaceId: string
  cwd: string
  nativeId: string | null
  firstPrompt: string
}

export const liveSessionMachine = xstateSetup({
  types: {
    input: {} as SessionStartInput,
    context: {} as {
      argoId: string | null
      first: SessionStartInput
      nativeId: string | null
      queue: QueuedLiveSessionCommand[]
      failure: string | null
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
          type: 'Harness ready'
          nativeId: string
        }
      | {
          type: 'Harness failed'
          failure: string
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
    reportHarnessSnapshot: enqueueActions(({ event, enqueue }) => {
      if (event.type !== 'xstate.snapshot.harness') return
      const snapshot = event.snapshot
      if (snapshot.matches('Failed'))
        enqueue.raise({
          type: 'Harness failed',
          failure: snapshot.context.failure ?? 'Harness failed.',
        })
      else if (snapshot.hasTag('ready') && snapshot.context.nativeId !== null)
        enqueue.raise({
          type: 'Harness ready',
          nativeId: snapshot.context.nativeId,
        })
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
        event.type === 'Harness ready' ? event.nativeId : context.nativeId,
    }),
    rememberHarnessFailure: assign({
      failure: ({ context, event }) =>
        event.type === 'Harness failed' ? event.failure : context.failure,
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
        'Harness ready': {
          target: 'Persisting',
          actions: 'rememberNativeId',
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
          harness: context.first.harness,
          projectId: context.first.projectId,
          workspaceId: context.first.workspaceId,
          cwd: context.first.cwd,
          nativeId: context.nativeId,
          firstPrompt: context.first.prompt,
        }),
        onDone: {
          target: 'Draining',
          actions: 'rememberArgoId',
        },
        onError: {
          target: 'Failed',
          actions: 'rememberPersistFailure',
        },
      },
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
})
