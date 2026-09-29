import type { BackgroundTaskRecord } from '@/domains/sessions/api/feed/background-task-record'
import type { SubagentCall, SubagentEvent } from '@/domains/sessions/api/feed/subagent-event'
import type { ToolCall } from '@/domains/sessions/api/feed/tool-call'
import type {
  ContentBlock,
  ToolResult,
  TranscriptEventKind,
} from '@/domains/sessions/api/feed/transcript-content'
import type { SessionEntry } from '@/domains/sessions/renderer/model/models'
import type { PlanChange } from './transcript-plan'
import type { TranscriptUsage } from './transcript-usage'

export type { BackgroundTaskRecord } from '@/domains/sessions/api/feed/background-task-record'
export { BACKGROUND_STATES } from '@/domains/sessions/api/feed/background-task-record'
export {
  SUBAGENT_EVENTS,
  type SubagentEvent,
  type SubagentEventName,
  type SubagentFacts,
} from '@/domains/sessions/api/feed/subagent-event'
export type {
  AskFacts,
  ExecuteFacts,
  FetchFacts,
  OtherFacts,
  ReadFacts,
  SearchFacts,
  SkillFacts,
  SubagentControlFacts,
  ToolCallStatus,
} from '@/domains/sessions/api/feed/tool-call'
export { TOOL_CALL_STATUSES } from '@/domains/sessions/api/feed/tool-call'
export type {
  ContentBlock,
  RichResultBlock,
  TranscriptEventKind,
} from '@/domains/sessions/api/feed/transcript-content'
export { TRANSCRIPT_EVENT_KINDS } from '@/domains/sessions/api/feed/transcript-content'
export type { PlanChange } from './transcript-plan'
export type { TranscriptUsage } from './transcript-usage'

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
  | SubagentEvent
  | { kind: 'link'; leafUuid: string }
  | { kind: 'title'; title: string; source: 'custom' | 'summarised' }
  // The Skill tool's result is a placeholder ("Launching skill: X"); the Harness delivers the skill's
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
      // target a stop names.
      subagentCall?: SubagentCall
      // A spawned thread's parent and path, which open that thread from the parent Session's
      // Subagent row.
      parentSessionId?: string | null
      agentPath?: string | null
      agentNickname?: string | null
      cwd?: string | null
      // The branch the Harness recorded beside the cwd.
      branch?: string | null
      // The model's actual context window as the Harness reports it, rather than a capacity the
      // cockpit can safely assume.
      contextWindowTokens?: number
    }
  | { kind: 'pull-request'; number: number; url: string; repository: string | null }
  // A Harness that writes its Plan outside any message, through a plan tool call.
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
  // `transcriptFileFrom` folds the later compaction summary into its boundary (#2206).
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
} from './transcript-file'
