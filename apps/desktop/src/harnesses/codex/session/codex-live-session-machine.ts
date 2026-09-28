import { assign, fromCallback, fromPromise, setup as xstateSetup } from 'xstate'
import { z } from 'zod'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type {
  SessionLiveInput,
  SessionStartInput,
} from '@/domains/sessions/main/api/session-submit'
import type { CodexRequest, WireMessage } from '../app-server/codex-app-server-client'

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

type TurnCommand = Pick<
  SessionStartInput,
  'attachments' | 'prompt' | 'turnConfiguration' | 'commandId'
>

type CodexLiveNotification =
  | { type: 'Turn started'; threadId: string; turnId: string }
  | { type: 'Thread idle'; threadId: string }
  | {
      type: 'Turn completed'
      threadId: string
      turnId: string
      status: 'completed' | 'failed' | 'interrupted'
    }
  | {
      type: 'Item completed'
      threadId: string
      turnId: string
      itemId: string
      role: 'user' | 'assistant'
      text: string
    }

const turnNotificationSchema = z.object({
  threadId: z.string().min(1),
  turn: z.object({
    id: z.string().min(1),
    status: z.enum(['inProgress', 'completed', 'failed', 'interrupted']),
  }),
})
const itemNotificationSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  item: z.object({
    id: z.string().min(1),
    type: z.string(),
    text: z.string().optional(),
    content: z.array(z.unknown()).optional(),
  }),
})
const userTextSchema = z.object({ type: z.literal('text'), text: z.string() })
const threadStatusSchema = z.object({
  threadId: z.string().min(1),
  status: z.object({ type: z.string().min(1) }),
})

export function observeCodexLiveNotifications(
  subscribe: (listener: (message: WireMessage) => void) => () => void,
) {
  return fromCallback<CodexLiveNotification>(({ sendBack }) => {
    let invalid = 0
    return subscribe((message) => {
      if (!('method' in message)) return
      switch (message.method) {
        case 'thread/status/changed': {
          const parsed = threadStatusSchema.safeParse(message.params)
          if (!parsed.success) break
          if (parsed.data.status.type === 'idle')
            sendBack({ type: 'Thread idle', threadId: parsed.data.threadId })
          return
        }
        case 'turn/started':
        case 'turn/completed': {
          const parsed = turnNotificationSchema.safeParse(message.params)
          if (!parsed.success) break
          const { threadId, turn } = parsed.data
          if (message.method === 'turn/started')
            sendBack({ type: 'Turn started', threadId, turnId: turn.id })
          else if (turn.status !== 'inProgress')
            sendBack({ type: 'Turn completed', threadId, turnId: turn.id, status: turn.status })
          return
        }
        case 'item/completed': {
          const parsed = itemNotificationSchema.safeParse(message.params)
          if (!parsed.success) break
          const { threadId, turnId, item } = parsed.data
          if (item.type === 'agentMessage' && item.text !== undefined)
            sendBack({
              type: 'Item completed',
              threadId,
              turnId,
              itemId: item.id,
              role: 'assistant',
              text: item.text,
            })
          else if (item.type === 'userMessage') {
            const text = (item.content ?? [])
              .flatMap((part) => {
                const parsed = userTextSchema.safeParse(part)
                return parsed.success ? [parsed.data.text] : []
              })
              .join('\n')
            if (text !== '')
              sendBack({
                type: 'Item completed',
                threadId,
                turnId,
                itemId: item.id,
                role: 'user',
                text,
              })
          }
          return
        }
        default:
          return
      }
      invalid += 1
      console.warn(`Invalid Codex live notification (${invalid}): ${message.method}`)
    })
  })
}

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

export const codexLiveSessionActors = (
  request: CodexRequest,
  subscribe: (listener: (message: WireMessage) => void) => () => void,
) => ({
  notifications: observeCodexLiveNotifications(subscribe),
  startThread: fromPromise(({ input }: { input: SessionLiveInput }) => {
    if ('resume' in input)
      return request(
        'thread/resume',
        {
          threadId: input.resume.nativeId,
          sandbox: input.turnConfiguration.mode,
        },
        (value) => threadStartResultSchema.parse(value).thread.id,
      )
    return request(
      'thread/start',
      {
        cwd: input.cwd,
        model: input.turnConfiguration.model,
        approvalPolicy: 'on-request',
        sandbox: input.turnConfiguration.mode,
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
          model: input.command.turnConfiguration.model,
          effort: input.command.turnConfiguration.effort,
        },
        (value) => turnStartResultSchema.parse(value).turn.id,
      )
    },
  ),
})

export const codexLiveSessionMachine = xstateSetup({
  types: {
    input: {} as SessionLiveInput,
    context: {} as {
      input: SessionLiveInput
      nativeId: string | null
      pending: TurnCommand | null
      inputItems: CodexInputItem[]
      failure: string | null
      activeTurnId: string | null
      activeCommandId: string | null
      completedTurnId: string | null
      feedSerial: number
      lastFeed: { serial: number; body: SessionLiveEventBody } | null
    },
    events: {} as
      | CodexLiveNotification
      | {
          type: 'Send'
          command: TurnCommand
        }
      | {
          type: 'Close'
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
    notifications: fromCallback<CodexLiveNotification>(() => () => {}),
    startThread: fromPromise<string, SessionLiveInput>(async () => {
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
  },
  actions: {
    rememberTurn: assign({
      activeTurnId: ({ context, event }) => {
        const turnId =
          event.type === 'Turn started'
            ? event.turnId
            : 'output' in event && typeof event.output === 'string'
              ? event.output
              : null
        return turnId === context.completedTurnId ? null : turnId ?? context.activeTurnId
      },
      activeCommandId: ({ context }) => context.pending?.commandId ?? context.activeCommandId,
      feedSerial: ({ context, event }) => {
        const turnId =
          event.type === 'Turn started'
            ? event.turnId
            : 'output' in event && typeof event.output === 'string'
              ? event.output
              : null
        return turnId !== null && turnId !== context.activeTurnId && turnId !== context.completedTurnId
          ? context.feedSerial + 1
          : context.feedSerial
      },
      lastFeed: ({ context, event }) => {
        const turnId =
          event.type === 'Turn started'
            ? event.turnId
            : 'output' in event && typeof event.output === 'string'
              ? event.output
              : null
        if (turnId === null || turnId === context.activeTurnId || turnId === context.completedTurnId)
          return context.lastFeed
        return {
          serial: context.feedSerial + 1,
          body: {
            type: 'status' as const,
            commandId: context.pending?.commandId ?? context.activeCommandId,
            turnId,
            vendorEventId: null,
            status: 'running' as const,
          },
        }
      },
    }),
    rememberCompletedTurn: assign({
      activeTurnId: () => null,
      activeCommandId: () => null,
      completedTurnId: ({ event, context }) =>
        event.type === 'Turn completed' ? event.turnId : context.completedTurnId,
      feedSerial: ({ context }) => context.feedSerial + 1,
      lastFeed: ({ context, event }) =>
        event.type === 'Turn completed'
          ? {
              serial: context.feedSerial + 1,
              body: {
                type: 'status',
                commandId: context.activeCommandId ?? context.pending?.commandId ?? null,
                turnId: event.turnId,
                vendorEventId: null,
                status: event.status === 'completed' ? 'idle' : 'unknown',
              },
            }
          : context.lastFeed,
    }),
    rememberCompletedItem: assign({
      feedSerial: ({ context }) => context.feedSerial + 1,
      lastFeed: ({ context, event }) =>
        event.type === 'Item completed'
          ? {
              serial: context.feedSerial + 1,
              body: {
                type: 'content',
                commandId: context.activeCommandId ?? context.pending?.commandId ?? null,
                turnId: event.turnId,
                vendorEventId: event.itemId,
                content: {
                  kind: 'message',
                  id: event.itemId,
                  role: event.role,
                  text: event.text,
                },
              },
            }
          : context.lastFeed,
    }),
    rememberThreadIdle: assign({
      feedSerial: ({ context }) => context.feedSerial + 1,
      lastFeed: ({ context }) => ({
        serial: context.feedSerial + 1,
        body: {
          type: 'status',
          commandId: null,
          turnId: null,
          vendorEventId: null,
          status: 'idle',
        },
      }),
    }),
    rememberNativeId: assign({
      nativeId: ({ context, event }) =>
        'output' in event && typeof event.output === 'string' ? event.output : context.nativeId,
    }),
    rememberFailure: assign({
      failure: ({ context, event }) => ('error' in event ? String(event.error) : context.failure),
    }),
    rememberPending: assign({
      pending: ({ context, event }) => (event.type === 'Send' ? event.command : context.pending),
    }),
    clearPending: assign({
      pending: () => null,
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
  },
}).createMachine({
  id: 'codexLiveSession',
  initial: 'Opening',
  context: ({ input }) => ({
    input,
    nativeId: null,
    pending: input,
    inputItems: [],
    failure: null,
    activeTurnId: null,
    activeCommandId: null,
    completedTurnId: null,
    feedSerial: 0,
    lastFeed: null,
  }),
  invoke: { id: 'notifications', src: 'notifications' },
  on: {
    'Thread idle': {
      guard: ({ context, event }) =>
        event.threadId === context.nativeId &&
        context.activeTurnId === null &&
        !(
          context.lastFeed?.body.type === 'status' &&
          context.lastFeed.body.status === 'idle'
        ),
      actions: 'rememberThreadIdle',
    },
    'Turn started': {
      guard: ({ context, event }) =>
        event.threadId === context.nativeId && context.pending !== null,
      actions: 'rememberTurn',
    },
    'Turn completed': {
      guard: ({ context, event }) =>
        event.threadId === context.nativeId &&
        event.turnId === context.activeTurnId &&
        context.completedTurnId !== event.turnId,
      actions: 'rememberCompletedTurn',
    },
    'Item completed': {
      guard: ({ context, event }) =>
        event.threadId === context.nativeId &&
        event.turnId === context.activeTurnId,
      actions: 'rememberCompletedItem',
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
          actions: 'rememberNativeId',
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
        onDone: {
          target: 'Ready',
          actions: ['rememberTurn', 'clearPending'],
        },
        onError: {
          target: 'Failed',
          actions: 'rememberFailure',
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
        onDone: {
          target: 'Ready',
          actions: ['rememberTurn', 'clearPending'],
        },
        onError: {
          target: 'Failed',
          actions: 'rememberFailure',
        },
      },
      on: {
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
