import {
  type CanUseTool,
  type PermissionMode,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { assign, fromCallback, sendTo, setup as xstateSetup } from 'xstate'
import { z } from 'zod'
import { type QuestionAnswer, questionSchema } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type {
  SessionLiveInput,
  SessionStartInput,
} from '@/domains/sessions/main/api/session-submit'
import type { SessionInteractionBroker } from '@/domains/sessions/main/live/session-interaction-broker'
import { claudeCliEnvironment } from '../cli-environment'
import { decodeClaudeLiveContent } from './claude-feed-decoder'
import { ClaudeLiveText } from './claude-live-text'

type Send = Pick<SessionStartInput, 'prompt' | 'commandId'>
type ClaudeLiveInput = SessionLiveInput & {
  interactions?: SessionInteractionBroker
}
type QueryCommand = {
  type: 'Send to Query'
  prompt: string
  commandId: string
}
type QueryEvent =
  | {
      type: 'Feed event'
      body: SessionLiveEventBody
    }
  | {
      type: 'Identified'
      nativeId: string
    }
  | {
      type: 'Opened'
      nativeId: string
    }
  | {
      type: 'Sent'
    }
  | {
      type: 'Query failed'
      detail: string
    }

const permissionModes: Record<string, PermissionMode> = {
  default: 'default',
  manual: 'default',
  acceptEdits: 'acceptEdits',
  bypassPermissions: 'bypassPermissions',
  plan: 'plan',
  dontAsk: 'dontAsk',
  auto: 'auto',
}
const askInputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        header: z.string().nullable(),
        multiSelect: z.boolean(),
        options: z.array(
          z.object({
            label: z.string().min(1),
            description: z.string().nullable(),
          }),
        ),
      }),
    )
    .min(1),
})

function answerText(answer: QuestionAnswer, question: z.infer<typeof questionSchema>): string {
  if (answer.kind === 'text') return answer.text
  return answer.indices
    .map((index) => question.options[index - 1]?.label)
    .filter((label): label is string => label !== undefined)
    .join(', ')
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
}

function decodedFeedEvents(
  message: SDKMessage,
  fallbackCommandId: string,
  reject: () => void,
): SessionLiveEventBody[] {
  const commandId =
    'user_message_uuid' in message && typeof message.user_message_uuid === 'string'
      ? message.user_message_uuid
      : fallbackCommandId
  return decodeClaudeLiveContent(message, reject).map((content) => ({
    type: 'content',
    content,
    commandId,
    turnId: commandId,
    vendorEventId: content.id,
  }))
}

export const claudeLiveSessionMachine = xstateSetup({
  types: {
    input: {} as ClaudeLiveInput,
    context: {} as {
      input: ClaudeLiveInput
      mode: PermissionMode | null
      nativeId: string | null
      failure: string | null
      feedSerial: number
      lastFeed: {
        serial: number
        body: SessionLiveEventBody
      } | null
    },
    events: {} as
      | QueryEvent
      | {
          type: 'Send'
          command: Send
        }
      | {
          type: 'Close'
        },
  },
  actors: {
    queryActor: fromCallback<
      QueryCommand,
      {
        command: ClaudeLiveInput
        mode: PermissionMode | null
      },
      QueryEvent
    >(({ input, receive, sendBack }) => {
      const prompts: Send[] = []
      let wake: (() => void) | null = null
      let session: Query | null = null
      let open = true
      let activeCommandId = input.command.commandId
      let nativeId: string | null = null
      let rejected = 0
      const liveText = new ClaudeLiveText()
      const emitStatus = (status: 'running' | 'idle') => {
        sendBack({
          type: 'Feed event',
          body: {
            type: 'status',
            status,
            commandId: activeCommandId,
            turnId: activeCommandId,
            vendorEventId: null,
          },
        })
      }
      const wakeInput = () => {
        wake?.()
        wake = null
      }
      async function* messages(): AsyncGenerator<SDKUserMessage> {
        while (open) {
          if (prompts.length === 0)
            await new Promise<void>((resolve) => {
              wake = resolve
            })
          const command = prompts.shift()
          if (command === undefined) continue
          activeCommandId = command.commandId
          sendBack({
            type: 'Feed event',
            body: {
              type: 'content',
              commandId: command.commandId,
              turnId: command.commandId,
              vendorEventId: command.commandId,
              content: {
                id: command.commandId,
                kind: 'message',
                role: 'user',
                text: command.prompt,
              },
            },
          })
          emitStatus('running')
          yield {
            type: 'user',
            message: {
              role: 'user',
              content: command.prompt,
            },
            parent_tool_use_id: null,
            uuid: (isUuid(command.commandId)
              ? command.commandId
              : crypto.randomUUID()) as SDKUserMessage['uuid'],
          }
        }
      }
      receive((event) => {
        prompts.push(event)
        wakeInput()
      })
      function emitOutput(
        message: Exclude<
          SDKMessage,
          {
            type: 'result'
          }
        >,
      ) {
        if (message.type === 'system' && message.subtype === 'init' && !opened) {
          nativeId = message.session_id
          sendBack({
            type: 'Identified',
            nativeId: message.session_id,
          })
        }
        if (message.type === 'assistant') liveText.settle(message.uuid)
        if (message.type === 'stream_event') {
          const content = liveText.append(message)
          if (content !== null) {
            const commandId = message.user_message_uuid ?? activeCommandId
            sendBack({
              type: 'Feed event',
              body: {
                type: 'content',
                content,
                commandId,
                turnId: commandId,
                vendorEventId: message.uuid,
              },
            })
          }
        }
        for (const body of decodedFeedEvents(message, activeCommandId, () => {
          rejected += 1
        }))
          sendBack({
            type: 'Feed event',
            body,
          })
      }
      let opened = false
      function finishTurn(
        message: Extract<
          SDKMessage,
          {
            type: 'result'
          }
        >,
      ) {
        if (message.is_error) throw new Error('Claude Session turn failed.')
        emitStatus('idle')
        if (opened)
          sendBack({
            type: 'Sent',
          })
        else {
          opened = true
          sendBack({
            type: 'Opened',
            nativeId: message.session_id,
          })
        }
      }
      const canUseTool: CanUseTool = async (toolName, toolInput, options) => {
        const broker = input.command.interactions
        if (broker === undefined || nativeId === null)
          return {
            behavior: 'deny',
            message: 'Session interaction is unavailable.',
          }
        const identity = {
          commandId: activeCommandId,
          turnId: activeCommandId,
          vendorEventId: options.requestId,
          requestId: options.requestId,
        }
        if (toolName === 'AskUserQuestion') {
          const parsed = askInputSchema.safeParse(toolInput)
          if (!parsed.success) {
            rejected += 1
            return {
              behavior: 'deny',
              message: 'Claude sent an unsupported Question.',
            }
          }
          const questions = parsed.data.questions.map((question) => questionSchema.parse(question))
          sendBack({
            type: 'Feed event',
            body: {
              type: 'question',
              ...identity,
              questions,
              answer: null,
            },
          })
          sendBack({
            type: 'Feed event',
            body: {
              type: 'status',
              ...identity,
              status: 'asking',
            },
          })
          const answers = await broker.requestQuestion({
            nativeId,
            requestId: options.requestId,
            questions,
            signal: options.signal,
          })
          const answer = questions
            .map((question, index) => answerText(answers[index] as QuestionAnswer, question))
            .join('; ')
          sendBack({
            type: 'Feed event',
            body: {
              type: 'question',
              ...identity,
              questions,
              answer,
            },
          })
          emitStatus('running')
          return {
            behavior: 'allow',
            updatedInput: {
              ...toolInput,
              answers: Object.fromEntries(
                questions.map((question, index) => [
                  question.question,
                  answerText(answers[index] as QuestionAnswer, question),
                ]),
              ),
            },
          }
        }
        sendBack({
          type: 'Feed event',
          body: {
            type: 'permission',
            ...identity,
            description: options.title ?? options.displayName ?? toolName,
          },
        })
        sendBack({
          type: 'Feed event',
          body: {
            type: 'status',
            ...identity,
            status: 'permission',
          },
        })
        const decision = await broker.requestPermission({
          nativeId,
          requestId: options.requestId,
          description: options.title ?? options.displayName ?? toolName,
          signal: options.signal,
        })
        emitStatus('running')
        switch (decision) {
          case 'allow':
            return {
              behavior: 'allow',
            }
          case 'allowForSession':
            return {
              behavior: 'allow',
              updatedPermissions: options.suggestions,
            }
          case 'deny':
            return {
              behavior: 'deny',
              message: 'The user denied this tool.',
            }
          case 'cancel':
            return {
              behavior: 'deny',
              message: 'The user cancelled this tool.',
              interrupt: true,
            }
        }
      }
      async function readResults(querySession: Query) {
        for await (const message of querySession) {
          if (!open) continue
          if (message.type === 'result') finishTurn(message)
          else emitOutput(message)
        }
        if (open) throw new Error('Claude Session ended before the turn completed.')
      }
      function reportFailure(error: unknown) {
        if (!open) return
        sendBack({
          type: 'Feed event',
          body: {
            type: 'failure',
            commandId: activeCommandId,
            turnId: activeCommandId,
            vendorEventId: null,
            detail: String(error),
          },
        })
        sendBack({
          type: 'Query failed',
          detail: String(error),
        })
      }
      void (async () => {
        try {
          if (input.mode === null) throw new Error('Unsupported Claude permission mode.')
          session = query({
            prompt: messages(),
            options: {
              cwd: 'resume' in input.command ? input.command.resume.cwd : input.command.cwd,
              ...('resume' in input.command
                ? {
                    resume: input.command.resume.nativeId,
                  }
                : {}),
              model: input.command.turnConfiguration.model,
              permissionMode: input.mode,
              includePartialMessages: true,
              ...(input.command.interactions === undefined
                ? {}
                : {
                    canUseTool,
                  }),
              env: claudeCliEnvironment(),
            },
          })
          await readResults(session)
        } catch (error) {
          reportFailure(error)
        } finally {
          if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude live shape(s).`)
          open = false
          wakeInput()
          session?.close()
        }
      })()
      return () => {
        open = false
        wakeInput()
        session?.close()
      }
    }),
  },
  actions: {
    preparePermissionMode: assign({
      mode: ({ context }) => permissionModes[context.input.turnConfiguration.mode] ?? null,
    }),
    rejectUnsupportedMode: assign({
      failure: ({ context }) =>
        `Unsupported Claude permission mode: ${context.input.turnConfiguration.mode}`,
    }),
    submitFirstPrompt: sendTo('queryActor', ({ context }) => ({
      type: 'Send to Query',
      prompt: context.input.prompt,
      commandId: context.input.commandId,
    })),
    rememberNativeId: assign({
      nativeId: ({ context, event }) =>
        event.type === 'Opened' || event.type === 'Identified' ? event.nativeId : context.nativeId,
    }),
    rememberFailure: assign({
      failure: ({ event }) => (event.type === 'Query failed' ? event.detail : null),
    }),
    rememberFeed: assign({
      feedSerial: ({ context }) => context.feedSerial + 1,
      lastFeed: ({ context, event }) =>
        event.type === 'Feed event'
          ? {
              serial: context.feedSerial + 1,
              body: event.body,
            }
          : context.lastFeed,
    }),
    forwardSend: sendTo('queryActor', ({ event }) => {
      if (event.type !== 'Send') throw new Error('Expected a Claude Session send.')
      return {
        type: 'Send to Query',
        prompt: event.command.prompt,
        commandId: event.command.commandId,
      }
    }),
  },
  guards: {
    hasPermissionMode: ({ context }) => context.mode !== null,
  },
}).createMachine({
  id: 'claudeLiveSession',
  initial: 'Preparing',
  context: ({ input }) => ({
    input,
    mode: null,
    nativeId: null,
    failure: null,
    feedSerial: 0,
    lastFeed: null,
  }),
  states: {
    Preparing: {
      entry: 'preparePermissionMode',
      always: [
        {
          guard: 'hasPermissionMode',
          target: 'Active',
        },
        {
          target: 'Failed',
          actions: 'rejectUnsupportedMode',
        },
      ],
    },
    Active: {
      invoke: {
        id: 'queryActor',
        src: 'queryActor',
        input: ({ context }) => ({
          command: context.input,
          mode: context.mode,
        }),
      },
      initial: 'Opening',
      states: {
        Opening: {
          entry: 'submitFirstPrompt',
          on: {
            Identified: {
              actions: 'rememberNativeId',
            },
            Opened: {
              target: 'Ready',
              actions: 'rememberNativeId',
            },
          },
        },
        Ready: {
          tags: 'ready',
          on: {
            Send: {
              target: 'Sending',
              actions: 'forwardSend',
            },
          },
        },
        Sending: {
          on: {
            Sent: 'Ready',
          },
        },
      },
      on: {
        'Feed event': {
          actions: 'rememberFeed',
        },
        'Query failed': {
          target: 'Failed',
          actions: 'rememberFailure',
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
