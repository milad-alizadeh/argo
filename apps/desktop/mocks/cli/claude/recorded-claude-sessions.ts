// The Agent SDK 0.3.278 `getSessionMessages` answer, read from a throwaway CLAUDE_CONFIG_DIR.
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { readRecordedCalls } from '../recorded-calls.ts'

// The source transcript was the hand-written envelope corpus; the SDK's reading of it is real.
export function recordedSessionMessages(): SessionMessage[] {
  const call = readRecordedCalls(
    'claude',
    'fixtures',
    'session-messages-claude-agent-sdk-0.3.278.json',
  ).find((candidate) => candidate.method === 'getSessionMessages')
  if (call === undefined) throw new Error('No recorded Claude getSessionMessages answer.')
  return call.result as SessionMessage[]
}
