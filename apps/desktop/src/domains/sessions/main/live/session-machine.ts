import { assign, fromPromise, setup } from 'xstate'
import type { SessionStartInput } from '../../contract/session-start'

export type QueuedSessionCommand = Pick<
  SessionStartInput,
  'commandId' | 'prompt' | 'attachments' | 'setup'
>
type SessionPersistInput = {
  harness: string
  projectId: string
  nativeId: string | null
  firstPrompt: string
}
export type SessionDrainInput = {
  nativeId: string | null
  command: QueuedSessionCommand | null
}

export const sessionMachine = setup({
  types: {
    input: {} as SessionStartInput,
    context: {} as {
      argoId: string | null
      first: SessionStartInput
      nativeId: string | null
      queue: QueuedSessionCommand[]
      failure: string | null
    },
    events: {} as
      | {
          type: 'Send'
          command: QueuedSessionCommand
        }
      | {
          type: 'Close'
        }
      | {
          type: 'xstate.done.actor.start'
          output: {
            nativeId: string
          }
        }
      | {
          type: 'xstate.done.actor.persist'
          output: string
        }
      | {
          type: 'xstate.done.actor.drain'
          output: undefined
        }
      | {
          type: 'xstate.error.actor.start'
          error: unknown
        }
      | {
          type: 'xstate.error.actor.persist'
          error: unknown
        }
      | {
          type: 'xstate.error.actor.drain'
          error: unknown
        },
  },
  actors: {
    start: fromPromise<
      {
        nativeId: string
      },
      SessionStartInput
    >(async () => {
      throw new Error('Session start actor was not provided.')
    }),
    persist: fromPromise<string, SessionPersistInput>(
      ({ input }: { input: SessionPersistInput }) => {
        void input
        throw new Error('Session persistence actor was not provided.')
      },
    ),
    drain: fromPromise<void, SessionDrainInput>(({ input }: { input: SessionDrainInput }) => {
      void input
      throw new Error('Session delivery actor was not provided.')
    }),
  },
  actions: {
    queueDistinct: assign({
      queue: ({ context, event }) =>
        event.type !== 'Send' ||
        event.command.commandId === context.first.commandId ||
        context.queue.some(({ commandId }) => commandId === event.command.commandId)
          ? context.queue
          : [
              ...context.queue,
              event.command,
            ],
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
        'output' in event &&
        typeof event.output === 'object' &&
        event.output !== null &&
        'nativeId' in event.output &&
        typeof event.output.nativeId === 'string'
          ? event.output.nativeId
          : context.nativeId,
    }),
    rememberPersistFailure: assign({
      failure: ({ context, event }) => ('error' in event ? String(event.error) : context.failure),
    }),
    rememberSendFailure: assign({
      failure: ({ context, event }) => ('error' in event ? String(event.error) : context.failure),
    }),
    rememberStartFailure: assign({
      failure: ({ context, event }) => ('error' in event ? String(event.error) : context.failure),
    }),
  },
  guards: {
    hasMoreQueuedSends: ({ context }) => context.queue.length > 1,
  },
}).createMachine({
  id: 'session',
  initial: 'Starting',
  context: ({ input }) => ({
    argoId: null,
    first: input,
    nativeId: null,
    queue: [],
    failure: null,
  }),
  states: {
    Starting: {
      invoke: {
        src: 'start',
        input: ({ context }) => context.first,
        onDone: {
          target: 'Persisting',
          actions: 'rememberNativeId',
        },
        onError: {
          target: 'Failed',
          actions: 'rememberStartFailure',
        },
      },
      on: {
        'xstate.done.actor.start': {
          target: 'Persisting',
          actions: 'rememberNativeId',
        },
        'xstate.error.actor.start': {
          target: 'Failed',
          actions: 'rememberStartFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    Persisting: {
      invoke: {
        src: 'persist',
        input: ({ context }) => ({
          harness: context.first.harness,
          projectId: context.first.projectId,
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
        'xstate.done.actor.persist': {
          target: 'Draining',
          actions: 'rememberArgoId',
        },
        'xstate.error.actor.persist': {
          target: 'Failed',
          actions: 'rememberPersistFailure',
        },
        Send: {
          actions: 'queueDistinct',
        },
        Close: 'Closed',
      },
    },
    Draining: {
      invoke: {
        src: 'drain',
        input: ({ context }) => ({
          nativeId: context.nativeId,
          command: context.queue[0] ?? null,
        }),
        onDone: [
          {
            target: 'Draining',
            reenter: true,
            guard: 'hasMoreQueuedSends',
            actions: 'dequeue',
          },
          {
            target: 'Ready',
            actions: 'dequeue',
          },
        ],
        onError: {
          target: 'Failed',
          actions: 'rememberSendFailure',
        },
      },
      on: {
        'xstate.done.actor.drain': [
          {
            target: 'Draining',
            reenter: true,
            guard: 'hasMoreQueuedSends',
            actions: 'dequeue',
          },
          {
            target: 'Ready',
            actions: 'dequeue',
          },
        ],
        'xstate.error.actor.drain': {
          target: 'Failed',
          actions: 'rememberSendFailure',
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
          actions: 'queueDistinct',
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
