// Real `codex app-server` answers, recorded once from codex-cli 0.157.0 in a throwaway CODEX_HOME.
import type { CodexRequest, ThreadReadResponse } from '@/harnesses/codex/app-server'
import type { RecordedCall } from '../recorded-calls.ts'
import recording from './fixtures/thread-history-codex-0.157.0.json' with { type: 'json' }

export type RecordedThread = ThreadReadResponse['thread']

export { recording as codexRecording }

export const recordedCalls: readonly RecordedCall[] = recording.calls

// The first recorded answer to `method`.
export function recordedCall(method: string): RecordedCall {
  const call = recordedCalls.find((candidate) => candidate.method === method)
  if (call === undefined) throw new Error(`No recorded Codex ${method} answer.`)
  return call
}

// The thread whose first prompt is `preview`, as `thread/read` answered it with its turns.
export function recordedThread(preview: string): RecordedThread {
  const thread = recordedCalls
    .flatMap((call) =>
      call.method === 'thread/read' ? [(call.result as ThreadReadResponse).thread] : [],
    )
    .find((candidate) => candidate.preview === preview)
  if (thread === undefined) throw new Error(`No recorded Codex thread opens with ${preview}.`)
  return thread
}

// A request that answers every call with this thread's `thread/read`, as the app-server would.
export function threadReadRequest(thread: RecordedThread): CodexRequest {
  return (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse({ thread })) as CodexRequest
}
