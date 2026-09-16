import type { FeedImageUrl } from './feed-images'
import type { FeedMarker, SessionEntry } from './models'

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

export type ToolCall = { id: string; name: string; input: Record<string, unknown> }
export type ToolResult = {
  callId: string
  content: string | null
  failed: boolean
  background?: { taskId: string; outputPath: string | null }
}
export type TranscriptUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

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
}

export const BACKGROUND_STATES = ['completed', 'failed', 'killed', 'stopped'] as const
export type BackgroundState = (typeof BACKGROUND_STATES)[number]

export const TRANSCRIPT_EVENT_KINDS = ['status', 'transcript', 'context', 'command'] as const
export type TranscriptEventKind = (typeof TRANSCRIPT_EVENT_KINDS)[number]

export type TranscriptRecord =
  | TranscriptMessage
  | { kind: 'command-output'; uuid: string; timestamp: string | null; text: string }
  | { kind: 'event'; uuid: string; event: TranscriptEventKind; text: string | null }
  | {
      kind: 'delegation'
      uuid: string
      actor: 'agent' | 'shell'
      action: string | null
      status: string | null
      progress: string | null
      groupId: string | null
      // The Shell call a background task's notification names, so its block can open that command.
      callId: string | null
      // A notice delivered while the Session was idle is a user record, so it carries the ending.
      ending?: BackgroundTaskRecord
    }
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
      cwd?: string | null
      // Codex records this on `task_started`; it is the model's actual context window, rather
      // than a capacity the cockpit can safely assume.
      contextWindowTokens?: number
    }
  | { kind: 'pull-request'; number: number; url: string; repository: string | null }
  | { kind: 'compaction'; uuid: string; timestamp?: string; summary?: string }
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
