// Real Agent SDK 0.3.278 answers, read once from Claude CLI 2.1.286 transcripts in a throwaway
// CLAUDE_CONFIG_DIR.
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { RecordedCall } from '../recorded-calls.ts'
import recording from './fixtures/session-history-claude-2.1.286.json' with { type: 'json' }

export { recording as claudeRecording }

const recordedCalls: readonly RecordedCall[] = recording.calls

function firstPrompt(messages: SessionMessage[]): unknown {
  return messages.find((message) => message.type === 'user')?.message
}

// The Session whose first prompt is `prompt`, as `getSessionMessages` answered it.
export function recordedSession(prompt: string): SessionMessage[] {
  const session = recordedCalls
    .flatMap((call) =>
      call.method === 'getSessionMessages' ? [call.result as SessionMessage[]] : [],
    )
    .find((messages) => {
      const message = firstPrompt(messages)
      return (
        typeof message === 'object' &&
        message !== null &&
        'content' in message &&
        message.content === prompt
      )
    })
  if (session === undefined) throw new Error(`No recorded Claude Session opens with ${prompt}.`)
  return session
}
