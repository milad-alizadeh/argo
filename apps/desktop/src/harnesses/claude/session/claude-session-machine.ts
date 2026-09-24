import {
  type PermissionMode,
  type Query,
  query,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { assign, fromCallback, sendTo, setup } from 'xstate'
import type { SessionStartInput } from '@/domains/sessions/contract/session-start'
import { claudeCliEnvironment } from '../cli-environment'

type Send = Pick<SessionStartInput, 'prompt'>
type QueryCommand = {
  type: 'Send to Query'
  prompt: string
}
type QueryEvent =
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

function permissionMode(value: string): PermissionMode {
  const mode = permissionModes[value]
  if (mode !== undefined) return mode
  throw new Error(`Unsupported Claude permission mode: ${value}`)
}

async function readClaudeResults(
  session: Query,
  isOpen: () => boolean,
  sendBack: (event: QueryEvent) => void,
) {
  let opened = false
  for await (const message of session) {
    if (!isOpen() || message.type !== 'result') continue
    if (message.is_error) throw new Error('Claude Session turn failed.')
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
  if (isOpen()) throw new Error('Claude Session ended before the turn completed.')
}

export const claudeSessionMachine = setup({
  types: {
    input: {} as SessionStartInput,
    context: {} as {
      input: SessionStartInput
      nativeId: string | null
      failure: string | null
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
    queryActor: fromCallback<QueryCommand, SessionStartInput, QueryEvent>(
      ({ input, receive, sendBack }) => {
        const prompts: string[] = []
        let wake: (() => void) | null = null
        let session: Query | null = null
        let open = true
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
            const prompt = prompts.shift()
            if (prompt === undefined) continue
            yield {
              type: 'user',
              message: {
                role: 'user',
                content: prompt,
              },
              parent_tool_use_id: null,
            }
          }
        }
        receive((event) => {
          prompts.push(event.prompt)
          wakeInput()
        })
        void (async () => {
          try {
            session = query({
              prompt: messages(),
              options: {
                cwd: input.cwd,
                model: input.setup.model,
                permissionMode: permissionMode(input.setup.mode),
                env: claudeCliEnvironment(),
              },
            })
            await readClaudeResults(session, () => open, sendBack)
          } catch (error) {
            if (open)
              sendBack({
                type: 'Query failed',
                detail: String(error),
              })
          } finally {
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
      },
    ),
  },
  actions: {
    submitFirstPrompt: sendTo('queryActor', ({ context }) => ({
      type: 'Send to Query',
      prompt: context.input.prompt,
    })),
    rememberNativeId: assign({
      nativeId: ({ event }) => (event.type === 'Opened' ? event.nativeId : null),
    }),
    rememberFailure: assign({
      failure: ({ event }) => (event.type === 'Query failed' ? event.detail : null),
    }),
    forwardSend: sendTo('queryActor', ({ event }) => {
      if (event.type !== 'Send') throw new Error('Expected a Claude Session send.')
      return {
        type: 'Send to Query',
        prompt: event.command.prompt,
      }
    }),
  },
}).createMachine({
  id: 'claudeSession',
  initial: 'Active',
  context: ({ input }) => ({
    input,
    nativeId: null,
    failure: null,
  }),
  states: {
    Active: {
      invoke: {
        id: 'queryActor',
        src: 'queryActor',
        input: ({ context }) => context.input,
      },
      initial: 'Opening',
      states: {
        Opening: {
          entry: 'submitFirstPrompt',
          on: {
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
