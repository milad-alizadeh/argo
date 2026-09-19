// The facts the Roster row draws beside its status, read off the Session's own records: the
// Subagents it delegated to, what the open Turn is doing, and when that Turn began. The Plan is
// `plan.ts`'s. Every one is DERIVED from Tool Calls the transcript names, and each is absent
// rather than guessed where the records do not carry it (CONTEXT.md L1 · degrade down).

import { fileName } from '@/domains/sessions/contract/file-presentation'
import type {
  SessionActivity,
  SessionDelegation,
  SessionShellCommand,
} from '@/domains/sessions/contract/models'
import { toolPresentation } from '@/domains/sessions/contract/tool-feed'
import type {
  ToolCall,
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/transcript'

export type BackgroundTask = Extract<TranscriptRecord, { kind: 'background-task' }>

// The one input field an activity names, in the order a call is likelier to carry it. A path is
// cut to its last segment, because the row is narrow and the deck head already draws the place.
const PATH_FIELDS = ['file_path', 'notebook_path', 'path']
const TEXT_FIELDS = ['pattern', 'description', 'command', 'url', 'query']

function calls(messages: TranscriptMessage[]): ToolCall[] {
  return messages.flatMap((message) => message.toolCalls)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

// When each call was written, and when the record answering it was. A call the transcript holds
// no answer for has no end, which is what makes it the work still open.
type CallTimes = { started: Map<string, string | null>; ended: Map<string, string | null> }

function callTimes(messages: TranscriptMessage[]): CallTimes {
  const started = new Map<string, string | null>()
  const ended = new Map<string, string | null>()
  for (const message of messages) {
    for (const call of message.toolCalls) started.set(call.id, message.timestamp)
    for (const callId of message.answeredCalls) ended.set(callId, message.timestamp)
  }
  return { started, ended }
}

// Every Subagent is read from the delegation records its adapter wrote (Codex's
// `SubAgentActivity`, Claude's spawning call and task notification), keyed by the group the
// adapter chose, so the Roster and the Feed name the same card for either CLI. A record with no
// status opened the thread; any status but `running` lands it.
export function readDelegations(records: TranscriptRecord[]): SessionDelegation[] {
  const delegations = new Map<string, SessionDelegation>()
  for (const record of records) {
    if (record.kind !== 'delegation' || record.actor !== 'agent' || record.groupId === null)
      continue
    const previous = delegations.get(record.groupId)
    const landed = record.status !== null && record.status !== 'running'
    delegations.set(record.groupId, {
      id: record.groupId,
      label: record.action ?? previous?.label ?? null,
      landed,
      startedAt: previous?.startedAt ?? record.timestamp ?? null,
      endedAt: landed ? (record.timestamp ?? null) : null,
    })
  }
  return [...delegations.values()]
}

function endings(notifications: BackgroundTask[]): Map<string, BackgroundTask> {
  return new Map(notifications.map((notification) => [notification.callId, notification]))
}

// The shell commands the Shell list draws, for every harness: a Tool Call its adapter classified
// as `execute` (CONTEXT.md L3 · Tool Call). A foreground call the transcript holds no result for
// is running; one that came back is what the Session did rather than what it is doing, so it is
// not read at all (#1907). A background call is the exception: its result is only a receipt, so
// it stays in the Shell list under the state its completion notification gives it (#1582).
export function readShellCommands(
  messages: TranscriptMessage[],
  notifications: BackgroundTask[],
): SessionShellCommand[] {
  const answered = new Set(messages.flatMap((message) => message.answeredCalls))
  const receipts = new Map(
    messages
      .flatMap((message) => message.toolResults ?? [])
      .flatMap((result) =>
        result.background === undefined ? [] : [[result.callId, result.background] as const],
      ),
  )
  const times = callTimes(messages)
  const ended = endings(notifications)
  return calls(messages)
    .flatMap((call) => (call.execute === undefined ? [] : [{ call, execute: call.execute }]))
    .flatMap(({ call, execute }) => {
      const receipt = receipts.get(call.id)
      if (receipt === undefined && answered.has(call.id)) return []
      const notification = ended.get(call.id)
      return [
        {
          id: call.id,
          command: execute.command,
          label: execute.label,
          background: receipt !== undefined || execute.background,
          state: notification?.state ?? ('running' as const),
          startedAt: times.started.get(call.id) ?? null,
          endedAt: notification?.timestamp ?? null,
          outputPath: notification?.outputPath ?? receipt?.outputPath ?? null,
          result: notification?.summary ?? null,
        },
      ]
    })
}

// A prompt is a user record that answers no Tool Call. A tool result is written as a user
// record too, and reading one as a prompt would restart the Turn at every tool the agent ran.
function lastPromptIndex(messages: TranscriptMessage[]): number {
  return messages.findLastIndex(
    (message) => message.role === 'user' && message.answeredCalls.length === 0,
  )
}

export function readTurnStartedAt(messages: TranscriptMessage[]): string | null {
  return messages[lastPromptIndex(messages)]?.timestamp ?? null
}

function readTarget(input: Record<string, unknown>): string | null {
  for (const field of PATH_FIELDS) {
    const path = text(input[field])
    if (path !== null) return path.split('/').findLast((segment) => segment.length > 0) ?? path
  }
  for (const field of TEXT_FIELDS) {
    const value = text(input[field])
    if (value !== null) return value.trim().split('\n', 1).join('')
  }
  return null
}

// What a classified call was about, read from the adapter's facts before any raw input field.
function callTarget(call: ToolCall): string | null {
  const edited = call.edit?.files.at(-1)
  if (edited !== undefined) return edited.file === null ? null : fileName(edited.file)
  if (call.read !== undefined) return call.read.target === null ? null : fileName(call.read.target)
  if (call.search !== undefined) return call.search.query
  if (call.fetch !== undefined) return call.fetch.url
  return readTarget(call.input)
}

function callActivity(call: ToolCall, open: boolean): SessionActivity {
  // An edit over several files is named by its newest file.
  const { label, kind } = toolPresentation(call, Math.max(0, (call.edit?.files.length ?? 1) - 1))
  return { label, kind, open, tool: call.name, target: callTarget(call) }
}

function thoughtActivity(message: TranscriptMessage): SessionActivity | null {
  const thought = message.blocks.findLast((block) => block.shape === 'thought')
  if (thought === undefined || thought.text.trim() === '') return null
  return { label: thought.text.trim(), kind: 'thought', open: true, tool: 'thought', target: null }
}

// What the Session is doing since the prompt that opened the Turn, the same words the Feed's
// live tail draws: the newest call still running or headline thought, whichever came last. A
// settled call outranks nothing but silence, as the Codex app keeps a headline over the commands
// it ran under it. Work from an earlier Turn reads nothing.
export function readActivity(messages: TranscriptMessage[]): SessionActivity | null {
  const turn = messages.slice(lastPromptIndex(messages) + 1)
  const answered = new Set(turn.flatMap((message) => message.answeredCalls))
  let settled: ToolCall | undefined
  for (const message of turn.toReversed()) {
    const call = message.toolCalls.at(-1)
    // An unanswered call older than a settled one was abandoned, not left running.
    if (call !== undefined && settled === undefined && !answered.has(call.id))
      return callActivity(call, true)
    const thought = thoughtActivity(message)
    if (thought !== null) return thought
    settled ??= call
  }
  return settled === undefined ? null : callActivity(settled, false)
}
