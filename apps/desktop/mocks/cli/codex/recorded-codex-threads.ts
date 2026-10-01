// Real `codex app-server` answers, recorded once from codex-cli 0.157.0 in a throwaway CODEX_HOME.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { ThreadReadResponse } from '@/harnesses/codex/app-server'

export type RecordedCall = { method: string; params: Record<string, unknown>; result: unknown }
export type RecordedThread = ThreadReadResponse['thread']

// A run always starts in `apps/desktop`; Playwright loads this as CommonJS, without `import.meta`.
const RECORDING = path.join(
  process.cwd(),
  'mocks',
  'cli',
  'codex',
  'fixtures',
  'thread-history-codex-0.157.0.json',
)

export function recordedCalls(): RecordedCall[] {
  return (JSON.parse(readFileSync(RECORDING, 'utf8')) as { calls: RecordedCall[] }).calls
}

// The first recorded answer to `method`.
export function recordedCall(method: string): RecordedCall {
  const call = recordedCalls().find((candidate) => candidate.method === method)
  if (call === undefined) throw new Error(`No recorded Codex ${method} answer.`)
  return call
}

// The thread whose first prompt is `preview`, as `thread/read` answered it with its turns.
export function recordedThread(preview: string): RecordedThread {
  const thread = recordedCalls()
    .flatMap((call) =>
      call.method === 'thread/read' ? [(call.result as ThreadReadResponse).thread] : [],
    )
    .find((candidate) => candidate.preview === preview)
  if (thread === undefined) throw new Error(`No recorded Codex thread opens with ${preview}.`)
  return thread
}
