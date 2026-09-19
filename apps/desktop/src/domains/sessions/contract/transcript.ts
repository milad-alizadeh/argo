import type { BackgroundTaskRecord } from '@/domains/sessions/contract/background-task-record'
import type { SessionEntry } from '@/domains/sessions/contract/models'
import type { ToolCall } from '@/domains/sessions/contract/tool-call'
import type {
  ContentBlock,
  ToolResult,
  TranscriptEventKind,
} from '@/domains/sessions/contract/transcript-content'
import type { PlanChange } from '@/domains/sessions/contract/transcript-plan'
import type { TranscriptUsage } from '@/domains/sessions/contract/transcript-usage'

export type {
  BackgroundState,
  BackgroundTaskRecord,
} from '@/domains/sessions/contract/background-task-record'
export { BACKGROUND_STATES } from '@/domains/sessions/contract/background-task-record'
export type {
  EditedFile,
  EditFacts,
  ExecuteFacts,
  FetchFacts,
  ReadFacts,
  SearchFacts,
  ToolCall,
  ToolCallStatus,
} from '@/domains/sessions/contract/tool-call'
export { TOOL_CALL_STATUSES } from '@/domains/sessions/contract/tool-call'
export type {
  ContentBlock,
  RichResultBlock,
  ToolResult,
  TranscriptEventKind,
} from '@/domains/sessions/contract/transcript-content'
export {
  resultText,
  TRANSCRIPT_EVENT_KINDS,
} from '@/domains/sessions/contract/transcript-content'

export type { PlanChange } from '@/domains/sessions/contract/transcript-plan'
export type { TranscriptUsage } from '@/domains/sessions/contract/transcript-usage'

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

export type TranscriptRecord =
  | TranscriptMessage
  | { kind: 'command-output'; uuid: string; timestamp: string | null; text: string }
  | { kind: 'event'; uuid: string; event: TranscriptEventKind; text: string | null }
  | {
      kind: 'delegation'
      uuid: string
      timestamp?: string | null
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
      // Codex records a spawned thread's parent and path in its session metadata. The adapter
      // uses them to open that thread from the parent Session's delegation card.
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
  // `readTranscriptFile` folds the later compaction summary into its boundary (#2206).
  | { kind: 'compaction-summary'; uuid: string; text: string }
  | BackgroundTaskRecord
  | { kind: 'unreadable'; line: string }

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

export {
  readTranscriptFile,
  transcriptFileFrom,
  withoutBlocks,
} from '@/domains/sessions/contract/transcript-file'
