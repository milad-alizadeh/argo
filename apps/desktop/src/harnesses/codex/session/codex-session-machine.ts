import { assign, fromCallback, fromPromise, sendTo, setup } from 'xstate'
import { z } from 'zod'
import type { SessionHistoryEntry } from '@/domains/sessions/contract/session-history'
import type { SessionMachineInput } from '@/domains/sessions/contract/session-start'
import type { CodexRequest, WireMessage } from '../app-server/codex-app-server-machine'

export type CodexInputItem =
  | {
      type: 'text'
      text: string
      text_elements: Array<{
        byteRange: {
          start: number
          end: number
        }
        placeholder: string
      }>
    }
  | {
      type: 'localImage'
      path: string
    }

export type CodexSessionResult = {
  nativeId: string
}

type TurnCommand = Pick<SessionMachineInput, 'commandId' | 'attachments' | 'prompt' | 'setup'>

const threadStartResultSchema = z.object({
  thread: z.object({
    id: z.string().min(1),
  }),
})
const turnStartResultSchema = z.object({
  turn: z.object({
    id: z.string().min(1),
  }),
})

const messageDeltaSchema = z.object({
  threadId: z.string(),
  itemId: z.string().min(1),
  delta: z.string(),
})
const completedMessageSchema = z.object({
  threadId: z.string(),
  item: z.object({
    type: z.literal('agentMessage'),
    id: z.string().min(1),
    text: z.string(),
  }),
})
const completedTurnSchema = z.object({
  threadId: z.string(),
  turn: z.object({
    id: z.string().min(1),
  }),
})

export function codexLiveEntry(
  message: WireMessage,
  nativeId: string,
  fragments: Map<string, string>,
): SessionHistoryEntry | null {
  if (!('method' in message)) return null
  switch (message.method) {
    case 'item/agentMessage/delta': {
      const parsed = messageDeltaSchema.safeParse(message.params)
      if (!parsed.success || parsed.data.threadId !== nativeId) return null
      const text = (fragments.get(parsed.data.itemId) ?? '') + parsed.data.delta
      fragments.set(parsed.data.itemId, text)
      return {
        sourceId: parsed.data.itemId,
        role: 'assistant',
        text,
      }
    }
    case 'item/completed': {
      const parsed = completedMessageSchema.safeParse(message.params)
      if (!parsed.success || parsed.data.threadId !== nativeId) return null
      fragments.set(parsed.data.item.id, parsed.data.item.text)
      return {
        sourceId: parsed.data.item.id,
        role: 'assistant',
        text: parsed.data.item.text,
      }
    }
    default:
      return null
  }
}

export const codexSessionActors = (
  request: CodexRequest,
  observe: (listener: (message: WireMessage) => void) => () => void = () => () => {},
) => ({
  notifications: fromCallback<
    {
      type: 'Set native ID'
      nativeId: string
    },
    SessionMachineInput,
    | {
        type: 'Feed entry'
        entry: SessionHistoryEntry
      }
    | {
        type: 'Turn completed'
        turnId: string
      }
  >(({ input, receive, sendBack }) => {
    let nativeId = 'argoId' in input ? input.nativeId : null
    const fragments = new Map<string, string>()
    receive((event) => {
      nativeId = event.nativeId
    })
    return observe((message) => {
      if ('method' in message && message.method === 'turn/completed') {
        const completed = completedTurnSchema.safeParse(message.params)
        if (completed.success && completed.data.threadId === nativeId)
          sendBack({
            type: 'Turn completed',
            turnId: completed.data.turn.id,
          })
      }
      const entry = nativeId === null ? null : codexLiveEntry(message, nativeId, fragments)
      if (entry !== null)
        sendBack({
          type: 'Feed entry',
          entry,
        })
    })
  }),
  startThread: fromPromise(async ({ input }: { input: SessionMachineInput }) => {
    if ('argoId' in input) {
      const inspectedId = await request(
        'thread/read',
        {
          threadId: input.nativeId,
          includeTurns: false,
        },
        (value) => threadStartResultSchema.parse(value).thread.id,
      )
      if (inspectedId !== input.nativeId) throw new Error('Codex read a different Session.')
      return request(
        'thread/resume',
        {
          threadId: input.nativeId,
        },
        (value) => {
          const nativeId = threadStartResultSchema.parse(value).thread.id
          if (nativeId !== input.nativeId) throw new Error('Codex resumed a different Session.')
          return nativeId
        },
      )
    }
    return request(
      'thread/start',
      {
        cwd: input.cwd,
        model: input.setup.model,
        approvalPolicy: 'on-request',
        sandbox: input.setup.mode,
      },
      (value) => threadStartResultSchema.parse(value).thread.id,
    )
  }),
  startTurn: fromPromise(
    ({
      input,
    }: {
      input: {
        command: TurnCommand | null
        nativeId: string | null
        inputItems: CodexInputItem[]
      }
    }) => {
      if (input.nativeId === null || input.command === null)
        throw new Error('Codex Session cannot start a turn without a thread and command.')
      return request(
        'turn/start',
        {
          threadId: input.nativeId,
          input: input.inputItems,
          model: input.command.setup.model,
          effort: input.command.setup.effort,
        },
        (value) => turnStartResultSchema.parse(value).turn.id,
      )
    },
  ),
})

export const codexSessionMachine = setup({
  types: {
    input: {} as SessionMachineInput,
    context: {} as {
      input: SessionMachineInput
      nativeId: string | null
      pending: TurnCommand | null
      queued: TurnCommand | null
      acceptedCommandId: string | null
      currentTurnId: string | null
      completedTurnIds: string[]
      working: boolean
      inputItems: CodexInputItem[]
      failure: string | null
      entries: SessionHistoryEntry[]
    },
    events: {} as
      | {
          type: 'Send'
          command: TurnCommand
        }
      | {
          type: 'Close'
        }
      | {
          type: 'Feed entry'
          entry: SessionHistoryEntry
        }
      | {
          type: 'Turn completed'
          turnId: string
        }
      | {
          type: 'xstate.done.actor.startThread'
          output: string
        }
      | {
          type: 'xstate.error.actor.startThread'
          error: unknown
        }
      | {
          type: 'xstate.done.actor.startFirstTurn'
          output: string
        }
      | {
          type: 'xstate.error.actor.startFirstTurn'
          error: unknown
        }
      | {
          type: 'xstate.done.actor.startNextTurn'
          output: string
        }
      | {
          type: 'xstate.error.actor.startNextTurn'
          error: unknown
        },
  },
  actors: {
    startThread: fromPromise<string, SessionMachineInput>(async () => {
      throw new Error('Codex thread actor was not provided.')
    }),
    startTurn: fromPromise<
      string,
      {
        command: TurnCommand | null
        nativeId: string | null
        inputItems: CodexInputItem[]
      }
    >(async () => {
      throw new Error('Codex turn actor was not provided.')
    }),
    notifications: fromCallback<
      {
        type: 'Set native ID'
        nativeId: string
      },
      SessionMachineInput,
      | {
          type: 'Feed entry'
          entry: SessionHistoryEntry
        }
      | {
          type: 'Turn completed'
          turnId: string
        }
    >(() => () => {}),
  },
  actions: {
    rememberNativeId: assign({
      nativeId: ({ context, event }) =>
        'output' in event && typeof event.output === 'string' ? event.output : context.nativeId,
    }),
    tellNotificationsNativeId: sendTo('notifications', ({ event }) => ({
      type: 'Set native ID',
      nativeId: 'output' in event && typeof event.output === 'string' ? event.output : '',
    })),
    rememberFailure: assign({
      failure: ({ context, event }) => ('error' in event ? String(event.error) : context.failure),
    }),
    rememberPending: assign({
      pending: ({ context, event }) => (event.type === 'Send' ? event.command : context.pending),
    }),
    clearPending: assign({
      pending: () => null,
    }),
    rememberAccepted: assign({
      acceptedCommandId: ({ context }) => context.pending?.commandId ?? context.acceptedCommandId,
      currentTurnId: ({ context, event }) =>
        'output' in event && typeof event.output === 'string'
          ? event.output
          : context.currentTurnId,
      working: () => true,
    }),
    queueNext: assign({
      queued: ({ event }) => (event.type === 'Send' ? event.command : null),
    }),
    takeQueued: assign({
      pending: ({ context }) => context.queued,
      queued: () => null,
    }),
    finishTurn: assign({
      working: () => false,
      currentTurnId: () => null,
      completedTurnIds: ({ context }) =>
        context.completedTurnIds.filter((turnId) => turnId !== context.currentTurnId),
    }),
    rememberEarlyCompletion: assign({
      completedTurnIds: ({ context, event }) =>
        event.type === 'Turn completed' && !context.completedTurnIds.includes(event.turnId)
          ? [
              ...context.completedTurnIds,
              event.turnId,
            ]
          : context.completedTurnIds,
    }),
    prepareInput: assign({
      inputItems: ({ context }) => {
        const command = context.pending
        if (command === null) throw new Error('Codex Session has no turn to prepare.')
        const items: CodexInputItem[] = [
          {
            type: 'text',
            text: command.prompt,
            text_elements: [],
          },
        ]
        for (const attachment of command.attachments) {
          if (attachment.kind === 'image')
            items.push({
              type: 'localImage',
              path: attachment.path,
            })
          else
            items.push({
              type: 'text',
              text: attachment.path,
              text_elements: [
                {
                  byteRange: {
                    start: 0,
                    end: Buffer.byteLength(attachment.path),
                  },
                  placeholder: attachment.path,
                },
              ],
            })
        }
        return items
      },
    }),
    rememberEntry: assign({
      entries: ({ context, event }) => {
        if (event.type !== 'Feed entry') return context.entries
        const position = context.entries.findIndex(
          ({ sourceId }) => sourceId === event.entry.sourceId,
        )
        if (position < 0)
          return [
            ...context.entries,
            event.entry,
          ]
        return context.entries.map((entry, index) => (index === position ? event.entry : entry))
      },
    }),
  },
  guards: {
    completedCurrentTurn: ({ context, event }) =>
      event.type === 'Turn completed' && event.turnId === context.currentTurnId,
    turnAlreadyCompleted: ({ context, event }) =>
      'output' in event &&
      typeof event.output === 'string' &&
      context.completedTurnIds.includes(event.output),
  },
}).createMachine({
  id: 'codexSession',
  initial: 'Opening',
  context: ({ input }) => ({
    input,
    nativeId: null,
    pending: input,
    queued: null,
    acceptedCommandId: null,
    currentTurnId: null,
    completedTurnIds: [],
    working: true,
    inputItems: [],
    failure: null,
    entries: [],
  }),
  invoke: {
    id: 'notifications',
    src: 'notifications',
    input: ({ context }) => context.input,
  },
  on: {
    'Feed entry': {
      actions: 'rememberEntry',
    },
  },
  states: {
    Opening: {
      invoke: {
        id: 'startThread',
        src: 'startThread',
        input: ({ context }) => context.input,
        onDone: {
          target: 'Starting first prompt',
          actions: [
            'rememberNativeId',
            'tellNotificationsNativeId',
          ],
        },
        onError: {
          target: 'Failed',
          actions: 'rememberFailure',
        },
      },
    },
    'Starting first prompt': {
      entry: 'prepareInput',
      invoke: {
        id: 'startFirstTurn',
        src: 'startTurn',
        input: ({ context }) => ({
          command: context.input,
          nativeId: context.nativeId,
          inputItems: context.inputItems,
        }),
        onDone: [
          {
            guard: 'turnAlreadyCompleted',
            target: 'Ready',
            actions: [
              'rememberAccepted',
              'clearPending',
              'finishTurn',
            ],
          },
          {
            target: 'Running',
            actions: [
              'rememberAccepted',
              'clearPending',
            ],
          },
        ],
        onError: {
          target: 'Failed',
          actions: 'rememberFailure',
        },
      },
      on: {
        'Turn completed': {
          actions: 'rememberEarlyCompletion',
        },
      },
    },
    Ready: {
      tags: 'ready',
      on: {
        Send: {
          target: 'Starting next prompt',
          actions: 'rememberPending',
        },
        Close: 'Closed',
      },
    },
    Running: {
      tags: 'ready',
      on: {
        Send: {
          actions: 'queueNext',
        },
        'Turn completed': [
          {
            guard: ({ context, event }) =>
              event.type === 'Turn completed' &&
              event.turnId === context.currentTurnId &&
              context.queued !== null,
            target: 'Starting next prompt',
            actions: 'takeQueued',
          },
          {
            guard: 'completedCurrentTurn',
            target: 'Ready',
            actions: 'finishTurn',
          },
        ],
        Close: 'Closed',
      },
    },
    'Starting next prompt': {
      entry: 'prepareInput',
      invoke: {
        id: 'startNextTurn',
        src: 'startTurn',
        input: ({ context }) => ({
          command: context.pending,
          nativeId: context.nativeId,
          inputItems: context.inputItems,
        }),
        onDone: [
          {
            guard: 'turnAlreadyCompleted',
            target: 'Ready',
            actions: [
              'rememberAccepted',
              'clearPending',
              'finishTurn',
            ],
          },
          {
            target: 'Running',
            actions: [
              'rememberAccepted',
              'clearPending',
            ],
          },
        ],
        onError: {
          target: 'Failed',
          actions: 'rememberFailure',
        },
      },
      on: {
        'Turn completed': {
          actions: 'rememberEarlyCompletion',
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
