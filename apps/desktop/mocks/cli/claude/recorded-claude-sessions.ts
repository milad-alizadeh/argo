// Real Agent SDK answers, recorded once from @anthropic-ai/claude-agent-sdk 0.3.278 in a throwaway CLAUDE_CONFIG_DIR.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'

export type RecordedCall = { method: string; params: Record<string, unknown>; result: unknown }

// A run always starts in `apps/desktop`; Playwright loads this as CommonJS, without `import.meta`.
const RECORDING = path.join(
  process.cwd(),
  'mocks',
  'cli',
  'claude',
  'fixtures',
  'session-messages-claude-agent-sdk-0.3.278.json',
)

export function recordedCalls(): RecordedCall[] {
  return (JSON.parse(readFileSync(RECORDING, 'utf8')) as { calls: RecordedCall[] }).calls
}

// The messages `getSessionMessages` answered for the recorded Session.
export function recordedSessionMessages(): SessionMessage[] {
  const call = recordedCalls().find((candidate) => candidate.method === 'getSessionMessages')
  if (call === undefined) throw new Error('No recorded Claude getSessionMessages answer.')
  return call.result as SessionMessage[]
}
