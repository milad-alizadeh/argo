import { assign, fromPromise, setup as xstateSetup } from 'xstate'
import { z } from 'zod'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-start'
import type { CodexRequest } from '../app-server/codex-app-server-machine'

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

type TurnCommand = Pick<SessionStartInput, 'attachments' | 'prompt' | 'turnConfiguration'>

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

export const codexLiveSessionActors = (request: CodexRequest) => ({
  startThread: fromPromise(({ input }: { input: SessionStartInput }) =>
    request(
      'thread/start',
      {
        cwd: input.cwd,
        model: input.turnConfiguration.model,
        approvalPolicy: 'on-request',
        sandbox: input.turnConfiguration.mode,
      },
      (value) => threadStartResultSchema.parse(value).thread.id,
    ),
  ),
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
    input: {} as SessionStartInput,
    context: {} as {
      input: SessionStartInput
      nativeId: string | null
      pending: TurnCommand | null
      inputItems: CodexInputItem[]
      failure: string | null
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
    startThread: fromPromise<string, SessionStartInput>(async () => {
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
  }),
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
          actions: 'clearPending',
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
          actions: 'clearPending',
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
