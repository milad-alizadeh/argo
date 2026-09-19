import type { FeedImageUrl } from './feed-images'
import type { FeedMarker, PlanEntryStatus, SessionEntry } from './models'
import type { SubagentEvent } from './subagent-event'
import type { ToolCall } from './tool-call'

export type {
  EditedFile,
  EditFacts,
  ExecuteFacts,
  FetchFacts,
  ReadFacts,
  SearchFacts,
  ToolCall,
  ToolCallStatus,
} from './tool-call'
export { TOOL_CALL_STATUSES } from './tool-call'

export type ContentBlock =
  | { shape: 'prose'; text: string }
  | { shape: 'thought'; text: string }
  | { shape: 'marker'; marker: FeedMarker }
  // `raw` is the protocol update's own untranslated text, shown behind a closed disclosure for
  // diagnostics; absent for a harness event, which has none worth keeping.
  | { shape: 'event'; event: TranscriptEventKind; text: string | null; raw?: string | null }
  | { shape: 'tool'; callId: string }
  | { shape: 'image'; url: FeedImageUrl }
  // A file the person attached to a prompt, by its absolute path.
  | { shape: 'file'; path: string }
  | { shape: 'source'; label: string; source: string }

export type RichResultBlock =
  | { shape: 'text'; text: string }
  | { shape: 'image'; url: FeedImageUrl }
export type ToolResult = {
  callId: string
  blocks: RichResultBlock[]
  failed: boolean
  background?: { taskId: string; outputPath: string | null }
}

export function resultText(blocks: readonly RichResultBlock[]): string | null {
  const text = blocks.flatMap((block) => (block.shape === 'text' ? [block.text] : []))
  return text.length === 0 ? null : text.join('\n')
}
export type TranscriptUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

// One change a record makes to its Session's Plan (CONTEXT.md L3 · Plan), as its adapter read it.
export type PlanChange =
  | { kind: 'replace'; entries: { content: string; status: PlanEntryStatus }[] }
  | { kind: 'unreadable' }
  // A step exists only once the result of the call that added it names the step's key.
  | { kind: 'add'; callId: string; content: string }
  | { kind: 'added'; callId: string; key: string }
  | { kind: 'update'; key: string; content: string | null; status: PlanEntryStatus | null }
  | { kind: 'remove'; key: string }

export type TranscriptMessage = {
  kind: 'message'
  uuid: string
  parentUuid: string | null
  originSessionId: string | null
  role: 'user' | 'assistant'
  sidechain: boolean
  cwd: string | null
  branch: string | null
  timestamp: string | null
  entry: SessionEntry
  stopReason: string | null
  model: string | null
  effort: string | null
  mode: string | null
  blocks: ContentBlock[]
  toolCalls: ToolCall[]
  toolResults?: ToolResult[]
  answeredCalls: string[]
  usage: TranscriptUsage | null
  planChanges?: PlanChange[]
}

// How a background command ends. An adapter folds its harness's own words for a stop into
// `interrupted`, so no notification word crosses the contract.
export const BACKGROUND_STATES = ['completed', 'failed', 'interrupted'] as const
export type BackgroundState = (typeof BACKGROUND_STATES)[number]

export {
  SUBAGENT_EVENTS,
  type SubagentEvent,
  type SubagentEventName,
  type SubagentFacts,
} from './subagent-event'

export const TRANSCRIPT_EVENT_KINDS = ['status', 'transcript', 'context', 'command'] as const
export type TranscriptEventKind = (typeof TRANSCRIPT_EVENT_KINDS)[number]

export type TranscriptRecord =
  | TranscriptMessage
  | { kind: 'command-output'; uuid: string; timestamp: string | null; text: string }
  | { kind: 'event'; uuid: string; event: TranscriptEventKind; text: string | null }
  | SubagentEvent
  | { kind: 'link'; leafUuid: string }
  | { kind: 'title'; title: string; source: 'custom' | 'summarised' }
  // The Skill tool's result is a placeholder ("Launching skill: X"); the CLI delivers the skill's
  // actual body as a separate, later user record tied back to the call by `sourceToolUseID`.
  | { kind: 'skill-body'; uuid: string; callId: string; text: string }
  // A hidden harness envelope draws no Feed row, but `boundary` preserves that a real transcript
  // delivery happened there so adjacent Tool Calls on either side do not become one group.
  | {
      kind: 'trace'
      uuid: string
      boundary?: boolean
      subagent?: boolean
      // A collaboration call the Subagent events read a fact from: the model a spawn chose, or the
      // target a stop names (`codex/sessions/subagent-calls.ts`).
      subagentCall?: {
        intent: 'start' | 'stop'
        callId: string
        timestamp: string | null
        target: string | null
        model: string | null
      }
      // Codex records a spawned thread's parent and path in its session metadata. The adapter
      // uses them to open that thread from the parent Session's Subagent row.
      parentSessionId?: string | null
      agentPath?: string | null
      agentNickname?: string | null
      cwd?: string | null
      // Codex writes the branch beside the cwd on `session_meta`, under `git`.
      branch?: string | null
      // Codex records this on `task_started`; it is the model's actual context window, rather
      // than a capacity the cockpit can safely assume.
      contextWindowTokens?: number
    }
  | { kind: 'pull-request'; number: number; url: string; repository: string | null }
  // A CLI that writes its Plan outside any message, as Codex's `update_plan` call does.
  | { kind: 'plan'; changes: PlanChange[] }
  | { kind: 'compaction'; uuid: string; timestamp?: string; summary?: string }
  | {
      kind: 'setup'
      startsTurn: boolean
      model: string | null
      effort: string | null
      mode: string | null
    }
  | { kind: 'usage'; contextTokens: number; spentTokens: number }
  | {
      kind: 'turn'
      uuid: string
      state: 'completed' | 'aborted'
      timestamp: string | null
    }
  // The harness re-delivers the compaction summary as a separate, later user turn than the
  // `compact_boundary` it belongs to; `readTranscriptFile` folds it into that record and this
  // kind never reaches a row on its own (#2206).
  | { kind: 'compaction-summary'; uuid: string; text: string }
  | BackgroundTaskRecord
  | { kind: 'unreadable'; line: string }

export type BackgroundTaskRecord = {
  kind: 'background-task'
  taskId: string
  callId: string
  outputPath: string | null
  state: BackgroundState
  summary: string | null
  timestamp: string | null
}

export type TranscriptFile = {
  path: string
  sessionId: string
  resumedFrom: string | null
  originSessionId: string | null
  openedAt: string
  openingPrompt: string | null
  records: TranscriptRecord[]
  unreadableLines: number
}

export type TranscriptParser = (line: string) => TranscriptRecord | null

export { readTranscriptFile, transcriptFileFrom, withoutBlocks } from './transcript-file'
