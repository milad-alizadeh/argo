// Real Agent SDK answers over real Claude CLI Sessions, written by `bun run record:vendor-history`
// and typed by the SDK's own declarations, so a recording that no longer fits fails the typecheck.
import type {
  getSessionMessages,
  listSessions,
  SDKSessionInfo,
  SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { recordedClaudeHistory as recorded } from '../../recordings/claude-cli'
import type { RecordingMetadata } from '../../recordings/recording'

export type RecordedClaudeCall =
  | {
      method: 'listSessions'
      params: NonNullable<Parameters<typeof listSessions>[0]>
      result: SDKSessionInfo[]
    }
  | {
      method: 'getSessionMessages'
      params: { sessionId: Parameters<typeof getSessionMessages>[0] }
      result: SessionMessage[]
    }

export type ClaudeRecording = RecordingMetadata & { agentSdk: string; calls: RecordedClaudeCall[] }

export const claudeRecording: ClaudeRecording = recorded

function opensWith(messages: SessionMessage[], prompt: string): boolean {
  const message = messages.find((candidate) => candidate.type === 'user')?.message
  return (
    typeof message === 'object' &&
    message !== null &&
    'content' in message &&
    message.content === prompt
  )
}

// The Session whose first prompt is `prompt`, as `getSessionMessages` answered it.
export function recordedSession(prompt: string): SessionMessage[] {
  const session = claudeRecording.calls
    .flatMap((call) => (call.method === 'getSessionMessages' ? [call.result] : []))
    .find((messages) => opensWith(messages, prompt))
  if (session === undefined) throw new Error(`No recorded Claude Session opens with ${prompt}.`)
  return session
}
