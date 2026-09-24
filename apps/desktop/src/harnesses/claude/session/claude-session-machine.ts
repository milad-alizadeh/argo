import {
  type PermissionMode,
  type Query,
  query,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { assign, fromPromise, setup } from 'xstate'
import type { SessionStartInput } from '@/domains/sessions/contract/session-start'
import { claudeCliEnvironment } from '../cli-environment'

type Send = Pick<SessionStartInput, 'prompt'>

const permissionModes: Record<string, PermissionMode> = {
  default: 'default',
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

function userMessage(prompt: string): SDKUserMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: prompt,
    },
    parent_tool_use_id: null,
  }
}

async function* oneMessage(prompt: string): AsyncGenerator<SDKUserMessage> {
  yield userMessage(prompt)
}

export function createClaudeSessionMachine() {
  let querySession: Query | null = null
  let nativeId: string | null = null
  return setup({
    types: {
      input: {} as SessionStartInput,
      context: {} as {
        input: SessionStartInput
        nativeId: string | null
        failure: string | null
      },
      events: {} as
        | {
            type: 'Send'
            command: Send
          }
        | {
            type: 'Close'
          },
    },
    actors: {
      open: fromPromise(async ({ input }: { input: SessionStartInput }) => {
        nativeId ??= crypto.randomUUID()
        querySession = query({
          prompt: (async function* () {})(),
          options: {
            cwd: input.cwd,
            sessionId: nativeId,
            model: input.setup.model,
            permissionMode: permissionMode(input.setup.mode),
            env: claudeCliEnvironment(),
          },
        })
        await querySession.initializationResult()
        await querySession.streamInput(oneMessage(input.prompt))
        return {
          nativeId,
        }
      }),
      send: fromPromise(({ input }: { input: Send }) => {
        if (querySession === null) throw new Error('Claude Session is closed.')
        return querySession.streamInput(oneMessage(input.prompt))
      }),
    },
    actions: {
      closeQuery: () => querySession?.close(),
    },
  }).createMachine({
    id: 'claudeSession',
    initial: 'Opening',
    context: ({ input }) => ({
      input,
      nativeId: null,
      failure: null,
    }),
    states: {
      Opening: {
        invoke: {
          src: 'open',
          input: ({ context }) => context.input,
          onDone: {
            target: 'Ready',
            actions: assign({
              nativeId: ({ event }) => event.output.nativeId,
            }),
          },
          onError: {
            target: 'Failed',
            actions: assign({
              failure: ({ event }) => String(event.error),
            }),
          },
        },
      },
      Ready: {
        on: {
          Send: 'Sending',
          Close: 'Closed',
        },
      },
      Sending: {
        invoke: {
          src: 'send',
          input: ({ event }) =>
            event.type === 'Send'
              ? event.command
              : {
                  prompt: '',
                },
          onDone: 'Ready',
          onError: {
            target: 'Failed',
            actions: assign({
              failure: ({ event }) => String(event.error),
            }),
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
        entry: 'closeQuery',
      },
    },
  })
}
