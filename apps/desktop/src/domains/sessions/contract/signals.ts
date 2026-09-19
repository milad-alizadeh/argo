// The facts the Roster row draws beside its status, read off the Session's own records: the
// Subagents it delegated to, what the open Turn is doing, and when that Turn began. The Plan is
// `plan.ts`'s. Every one is DERIVED from Tool Calls the transcript names, and each is absent
// rather than guessed where the records do not carry it (CONTEXT.md L1 · degrade down).

import { fileName } from './file-presentation'
import type { SessionActivity, SessionShellCommand, SessionSubagent } from './models'
import { toolPresentation } from './tool-feed'
import type { ToolCall, TranscriptMessage, TranscriptRecord } from './transcript'

export type BackgroundTask = Extract<TranscriptRecord, { kind: 'background-task' }>

// The one input field an activity names, in the order a call is likelier to carry it. A path is
// cut to its last segment, because the row is narrow and the deck head already draws the place.
function calls(messages: TranscriptMessage[]): ToolCall[] {
  return messages.flatMap((message) => message.toolCalls)
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

// Every Subagent is folded from the lifecycle events its adapter wrote, keyed by Subagent id, so
// the Roster and the Feed name the same state for either harness: a `started` or `messaged` event
// leaves it running and a `responded` one ends it in the state it carries.
export function readSubagents(records: TranscriptRecord[]): SessionSubagent[] {
  const subagents = new Map<string, SessionSubagent>()
  for (const record of records) {
    if (record.kind !== 'subagent') continue
    const previous = subagents.get(record.subagentId)
    subagents.set(record.subagentId, {
      id: record.subagentId,
      label: record.name ?? previous?.label ?? null,
      state: record.event === 'responded' ? record.state : 'running',
      startedAt: previous?.startedAt ?? record.timestamp,
      endedAt: record.event === 'responded' ? record.timestamp : null,
    })
  }
  return [...subagents.values()]
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
    .flatMap((call) => (call.kind === 'execute' ? [{ call, execute: call }] : []))
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

// What a classified call was about, expressed only in the typed adapter facts.
function callTarget(call: ToolCall): string | null {
  switch (call.kind) {
    case 'edit': {
      const edited = call.files.at(-1)
      return edited?.file === null || edited === undefined ? null : fileName(edited.file)
    }
    case 'read':
      return call.target === null ? null : fileName(call.target)
    case 'search':
      return call.query
    case 'fetch':
      return call.url
    case 'execute':
      return null
    case 'skill':
      return call.title
    case 'other':
      return call.label
    case 'ask':
      return call.questions[0]?.question ?? null
    case 'subagent-control':
      return call.name
  }
}

function callActivity(call: ToolCall, open: boolean): SessionActivity {
  // An edit over several files is named by its newest file.
  const { label, kind } = toolPresentation(
    call,
    Math.max(0, (call.kind === 'edit' ? call.files.length : 1) - 1),
  )
  return { label, kind, open, tool: call.kind, target: callTarget(call) }
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
    const call = message.toolCalls.findLast(
      (candidate) => candidate.kind !== 'ask' && candidate.kind !== 'subagent-control',
    )
    // An unanswered call older than a settled one was abandoned, not left running.
    if (call !== undefined && settled === undefined && !answered.has(call.id))
      return callActivity(call, true)
    const thought = thoughtActivity(message)
    if (thought !== null) return thought
    settled ??= call
  }
  return settled === undefined ? null : callActivity(settled, false)
}
