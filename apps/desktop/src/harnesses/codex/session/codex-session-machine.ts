import { assign, fromPromise, setup } from 'xstate'
import { z } from 'zod'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { SessionStartInput } from '@/domains/sessions/contract/session-start'
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

export function codexInputItems(
  prompt: string,
  attachments: SessionAttachmentInput[],
): CodexInputItem[] {
  const text = [
    {
      type: 'text' as const,
      text: prompt,
      text_elements: [],
    },
  ]
  return attachments.reduce<CodexInputItem[]>((items, attachment) => {
    if (attachment.kind === 'image')
      return [
        ...items,
        {
          type: 'localImage',
          path: attachment.path,
        },
      ]
    const byteLength = Buffer.byteLength(attachment.path)
    return [
      ...items,
      {
        type: 'text',
        text: attachment.path,
        text_elements: [
          {
            byteRange: {
              start: 0,
              end: byteLength,
            },
            placeholder: attachment.path,
          },
        ],
      },
    ]
  }, text)
}

export type CodexSessionResult = {
  nativeId: string
}

type TurnCommand = Pick<SessionStartInput, 'attachments' | 'prompt' | 'setup'>

const threadStartResultSchema = z.object({
  thread: z.object({
    id: z.string().min(1),
  }),
})

export function createCodexSessionMachine(request: CodexRequest) {
  return setup({
    types: {
      input: {} as SessionStartInput,
      context: {} as {
        input: SessionStartInput
        nativeId: string | null
        pending: TurnCommand | null
        failure: string | null
      },
      events: {} as
        | {
            type: 'Send'
            command: TurnCommand
          }
        | {
            type: 'Close'
          },
    },
    actors: {
      startThread: fromPromise(({ input }: { input: SessionStartInput }) =>
        request(
          'thread/start',
          {
            cwd: input.cwd,
            model: input.setup.model,
            approvalPolicy: 'on-request',
            sandbox: input.setup.mode,
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
          }
        }) => {
          if (input.nativeId === null || input.command === null)
            throw new Error('Codex Session cannot start a turn without a thread and command.')
          return request(
            'turn/start',
            {
              threadId: input.nativeId,
              input: codexInputItems(input.command.prompt, input.command.attachments),
              model: input.command.setup.model,
              effort: input.command.setup.effort,
            },
            (value) => value,
          )
        },
      ),
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
    },
  }).createMachine({
    id: 'codexSession',
    initial: 'Opening',
    context: ({ input }) => ({
      input,
      nativeId: null,
      pending: null,
      failure: null,
    }),
    states: {
      Opening: {
        invoke: {
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
        invoke: {
          src: 'startTurn',
          input: ({ context }) => ({
            command: context.input,
            nativeId: context.nativeId,
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
        on: {
          Send: {
            target: 'Starting next prompt',
            actions: 'rememberPending',
          },
          Close: 'Closed',
        },
      },
      'Starting next prompt': {
        invoke: {
          src: 'startTurn',
          input: ({ context }) => ({
            command: context.pending,
            nativeId: context.nativeId,
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
}
