// Real `codex app-server` answers, written by `bun run record:vendor-history` and typed by the
// app-server's own generated protocol, so a recording that no longer fits fails the typecheck.
import type {
  CodexRequest,
  ConfigLayer,
  ConfigReadParams,
  ThreadListParams,
  ThreadListResponse,
  ThreadReadParams,
  ThreadReadResponse,
  ThreadTurnsListParams,
  ThreadTurnsListResponse,
} from '@/harnesses/codex/app-server'
import { recordedCodexHistory as recorded } from '../../recordings/codex-app-server'
import type { RecordingMetadata } from '../../recordings/recording'
import { mockTurnsRequest } from './mock-codex-turn-pages'

export type RecordedCodexCall =
  | { method: 'thread/list'; params: ThreadListParams; result: ThreadListResponse }
  | { method: 'thread/read'; params: ThreadReadParams; result: ThreadReadResponse }
  | { method: 'thread/turns/list'; params: ThreadTurnsListParams; result: ThreadTurnsListResponse }
  // Only the layers, read under a user config that holds hooks of its own.
  | { method: 'config/read'; params: ConfigReadParams; result: { layers: RecordedConfigLayer[] } }

// codex 0.157 leaves out a null `disabledReason`.
type RecordedConfigLayer = Omit<ConfigLayer, 'disabledReason'> &
  Partial<Pick<ConfigLayer, 'disabledReason'>>

export type CodexRecording = RecordingMetadata & { calls: RecordedCodexCall[] }

export type RecordedThread = ThreadReadResponse['thread']

export const codexRecording: CodexRecording = recorded

type RecordedAnswer<Method extends RecordedCodexCall['method']> = Extract<
  RecordedCodexCall,
  { method: Method }
>

// Every recorded answer to `method`.
export function recordedCalls<Method extends RecordedCodexCall['method']>(
  method: Method,
): RecordedAnswer<Method>[] {
  return codexRecording.calls.filter(
    (call): call is RecordedAnswer<Method> => call.method === method,
  )
}

// The first recorded answer to `method`.
export function recordedCall<Method extends RecordedCodexCall['method']>(
  method: Method,
): RecordedAnswer<Method> {
  const [call] = recordedCalls(method)
  if (call === undefined) throw new Error(`No recorded Codex ${method} answer.`)
  return call
}

// Every recorded thread, its metadata read joined with the Turns its `thread/turns/list` pages hold.
export function recordedThreads(): RecordedThread[] {
  return recordedCalls('thread/read').map(({ result: { thread } }) => ({
    ...thread,
    turns: recordedCalls('thread/turns/list')
      .filter((call) => call.params.threadId === thread.id)
      .flatMap((call) => call.result.data),
  }))
}

// The thread whose first prompt is `preview`, with its Turns.
export function recordedThread(preview: string): RecordedThread {
  const thread = recordedThreads().find((candidate) => candidate.preview === preview)
  if (thread === undefined) throw new Error(`No recorded Codex thread opens with ${preview}.`)
  return thread
}

// A request that reads this thread as the app-server would: metadata, and Turns page by page.
export function recordedThreadRequest(thread: RecordedThread): CodexRequest {
  return mockTurnsRequest(thread.turns, thread)
}
