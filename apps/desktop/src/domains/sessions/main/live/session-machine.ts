import { assign, enqueueActions, fromPromise, type SnapshotFrom, sendTo, setup } from 'xstate'
import { claudeSessionMachine } from '@/harnesses/claude/session/claude-session-machine'
import type { codexSessionMachine } from '@/harnesses/codex/session/codex-session-machine'
import type { SessionHistoryEntry } from '../../contract/session-history'
import type { SessionIngestion } from '../../contract/session-index'
import type { SessionMachineInput, SessionStartInput } from '../../contract/session-start'

export type QueuedSessionCommand = Pick<
  SessionStartInput,
  'commandId' | 'prompt' | 'attachments' | 'setup'
>
export type SessionPersistInput = {
  session: SessionIngestion
  projectId: string
}

function persistenceInput(
  first: SessionMachineInput,
  nativeId: string | null,
): SessionPersistInput {
  if ('argoId' in first) throw new Error('An existing Session must not create another identity.')
  if (nativeId === null) throw new Error('Session has no native ID to persist.')
  return {
    projectId: first.projectId,
    session: {
      harness: first.harness,
      nativeId,
      vendorTitle: null,
      firstPrompt: first.prompt,
      updatedAt: Date.now(),
      workingDirectory: first.cwd,
    },
  }
}

export const sessionMachine = setup({
  types: {
    input: {} as SessionMachineInput,
    context: {} as {
      argoId: string | null
      acceptedCommandIds: string[]
      first: SessionMachineInput
      nativeId: string | null
      queue: QueuedSessionCommand[]
      failure: string | null
      entries: SessionHistoryEntry[]
      working: boolean
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
          type: 'Harness ready'
          nativeId: string
          commandId?: string
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
          snapshot: SnapshotFrom<typeof claudeSessionMachine | typeof codexSessionMachine>
        },
  },
  actors: {
    harness: claudeSessionMachine as typeof claudeSessionMachine | typeof codexSessionMachine,
    persist: fromPromise<string, SessionPersistInput>(async () => {
      throw new Error('Session persistence actor was not provided.')
    }),
  },
  actions: {
    rememberHarnessEntries: assign({
      entries: ({ context, event }) =>
        event.type === 'xstate.snapshot.harness' ? event.snapshot.context.entries : context.entries,
    }),
    rememberHarnessWorking: assign({
      working: ({ context, event }) =>
        event.type === 'xstate.snapshot.harness' ? event.snapshot.context.working : context.working,
    }),
    reportHarnessSnapshot: enqueueActions(({ context, event, enqueue }) => {
      if (event.type !== 'xstate.snapshot.harness') return
      const snapshot = event.snapshot
      if (snapshot.matches('Failed'))
        enqueue.raise({
          type: 'Harness failed',
          failure: snapshot.context.failure ?? 'Harness failed.',
        })
      else if (
        snapshot.context.nativeId !== null &&
        snapshot.context.acceptedCommandId ===
          (context.acceptedCommandIds.includes(context.first.commandId)
            ? context.queue[0]?.commandId
            : context.first.commandId)
      )
        enqueue.raise({
          type: 'Harness ready',
          nativeId: snapshot.context.nativeId,
          commandId: snapshot.context.acceptedCommandId,
        })
    }),
    queueDistinct: assign({
      queue: ({ context, event }) =>
        event.type === 'Send' &&
        event.command.commandId !== context.first.commandId &&
        !context.acceptedCommandIds.includes(event.command.commandId) &&
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
    rememberAcceptedCommand: assign({
      acceptedCommandIds: ({ context, event }) => {
        const commandId =
          event.type === 'Harness ready'
            ? (event.commandId ??
              (context.acceptedCommandIds.length === 0
                ? context.first.commandId
                : context.queue[0]?.commandId) ??
              null)
            : null
        return commandId === null || context.acceptedCommandIds.includes(commandId)
          ? context.acceptedCommandIds
          : [
              ...context.acceptedCommandIds,
              commandId,
            ]
      },
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
    hasArgoId: ({ context }) => context.argoId !== null,
    isNewCommand: ({ context, event }) =>
      event.type === 'Send' &&
      event.command.commandId !== context.first.commandId &&
      !context.acceptedCommandIds.includes(event.command.commandId) &&
      !context.queue.some(({ commandId }) => commandId === event.command.commandId),
  },
}).createMachine({
  id: 'session',
  initial: 'Starting',
  context: ({ input }) => ({
    argoId: 'argoId' in input ? input.argoId : null,
    acceptedCommandIds: [],
    first: input,
    nativeId: null,
    queue: [],
    failure: null,
    entries: [],
    working: true,
  }),
  invoke: {
    id: 'harness',
    src: 'harness',
    input: ({ context }) => context.first,
    onSnapshot: {
      actions: [
        'rememberHarnessEntries',
        'rememberHarnessWorking',
        'reportHarnessSnapshot',
      ],
    },
  },
  states: {
    Starting: {
      on: {
        'Harness ready': [
          {
            guard: 'hasArgoId',
            target: 'Draining',
            actions: [
              'rememberNativeId',
              'rememberAcceptedCommand',
            ],
          },
          {
            target: 'Persisting',
            actions: [
              'rememberNativeId',
              'rememberAcceptedCommand',
            ],
          },
        ],
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
        input: ({ context }) => persistenceInput(context.first, context.nativeId),
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
          actions: [
            'rememberAcceptedCommand',
            'dequeue',
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
