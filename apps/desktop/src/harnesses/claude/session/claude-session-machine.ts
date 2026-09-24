import {
  type PermissionMode,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { assign, fromCallback, sendTo, setup } from 'xstate'
import type { SessionHistoryEntry } from '@/domains/sessions/contract/session-history'
import type { SessionMachineInput } from '@/domains/sessions/contract/session-start'
import { claudeCliEnvironment } from '../cli-environment'
import { parseClaudeHistory } from './claude-history'

type Send = Pick<SessionMachineInput, 'prompt' | 'commandId'>
type QueryCommand = {
  type: 'Send to Query'
  prompt: string
}
type QueryEvent =
  | {
      type: 'Feed entry'
      entry: SessionHistoryEntry
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

export const claudeSessionMachine = setup({
  types: {
    input: {} as SessionMachineInput,
    context: {} as {
      input: SessionMachineInput
      mode: PermissionMode | null
      nativeId: string | null
      failure: string | null
      entries: SessionHistoryEntry[]
      acceptedCommandId: string | null
      pendingCommandId: string | null
      working: boolean
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
        command: SessionMachineInput
        mode: PermissionMode | null
      },
      QueryEvent
    >(({ input, receive, sendBack }) => {
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
      const reportResult = (
        message: {
          is_error: boolean
          session_id: string
        },
        opened: boolean,
      ) => {
        if (message.is_error) throw new Error('Claude Session turn failed.')
        if (opened) {
          sendBack({
            type: 'Sent',
          })
          return true
        }
        if ('argoId' in input.command && message.session_id !== input.command.nativeId)
          throw new Error('Claude resumed a different Session.')
        sendBack({
          type: 'Opened',
          nativeId: message.session_id,
        })
        return true
      }
      const publishEntries = (message: SDKMessage) => {
        if (message.type !== 'assistant' && message.type !== 'user') return
        for (const entry of parseClaudeHistory([
          message,
        ]))
          sendBack({
            type: 'Feed entry',
            entry,
          })
      }
      async function readResults(querySession: Query) {
        let opened = false
        for await (const message of querySession) {
          if (!open) continue
          publishEntries(message)
          if (message.type === 'result') opened = reportResult(message, opened)
        }
        if (open) throw new Error('Claude Session ended before the turn completed.')
      }
      void (async () => {
        try {
          if (input.mode === null) throw new Error('Unsupported Claude permission mode.')
          session = query({
            prompt: messages(),
            options: {
              cwd: input.command.cwd ?? undefined,
              model: input.command.setup.model,
              permissionMode: input.mode,
              ...('argoId' in input.command
                ? {
                    resume: input.command.nativeId,
                  }
                : {}),
              env: claudeCliEnvironment(),
            },
          })
          await readResults(session)
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
    }),
  },
  actions: {
    preparePermissionMode: assign({
      mode: ({ context }) => permissionModes[context.input.setup.mode] ?? null,
    }),
    rejectUnsupportedMode: assign({
      failure: ({ context }) => `Unsupported Claude permission mode: ${context.input.setup.mode}`,
    }),
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
    rememberPendingCommand: assign({
      pendingCommandId: ({ event }) => (event.type === 'Send' ? event.command.commandId : null),
      working: () => true,
    }),
    rememberAcceptedCommand: assign({
      acceptedCommandId: ({ context, event }) => {
        switch (event.type) {
          case 'Opened':
            return context.input.commandId
          case 'Sent':
            return context.pendingCommandId
          default:
            return context.acceptedCommandId
        }
      },
      working: () => false,
    }),
    forwardSend: sendTo('queryActor', ({ event }) => {
      if (event.type !== 'Send') throw new Error('Expected a Claude Session send.')
      return {
        type: 'Send to Query',
        prompt: event.command.prompt,
      }
    }),
  },
  guards: {
    hasPermissionMode: ({ context }) => context.mode !== null,
  },
}).createMachine({
  id: 'claudeSession',
  initial: 'Preparing',
  context: ({ input }) => ({
    input,
    mode: null,
    nativeId: null,
    failure: null,
    entries: [],
    acceptedCommandId: null,
    pendingCommandId: null,
    working: true,
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
            Opened: {
              target: 'Ready',
              actions: [
                'rememberNativeId',
                'rememberAcceptedCommand',
              ],
            },
          },
        },
        Ready: {
          tags: 'ready',
          on: {
            Send: {
              target: 'Sending',
              actions: [
                'rememberPendingCommand',
                'forwardSend',
              ],
            },
          },
        },
        Sending: {
          on: {
            Sent: {
              target: 'Ready',
              actions: 'rememberAcceptedCommand',
            },
          },
        },
      },
      on: {
        'Feed entry': {
          actions: 'rememberEntry',
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
