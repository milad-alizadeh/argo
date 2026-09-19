// The facts the Roster row draws beside its status, read off the Session's own records: the
// Subagents it delegated to, what the open Turn is doing, and when that Turn began. The Plan is
// `plan.ts`'s. Every one is DERIVED from Tool Calls the transcript names, and each is absent
// rather than guessed where the records do not carry it (CONTEXT.md L1 · degrade down).

import type { SessionActivity, SessionDelegation, SessionShellCommand } from './models'
import { executableToolCall, toolPresentation, toolTarget } from './tool-feed'
import type { ToolCall, TranscriptMessage, TranscriptRecord } from './transcript'

export type BackgroundTask = Extract<TranscriptRecord, { kind: 'background-task' }>

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

// The shell commands the Shell list draws. A foreground executable call the transcript holds no
// result for is running; one that came back is what the Session did rather than what it is doing,
// so it is not read at all (#1907). A background call is the exception: its result is only a
// receipt, so it stays in the Shell list under the state its completion notification gives it.
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
  return calls(messages).flatMap((call) => {
    const executable = executableToolCall(call)
    if (executable === null) return []
    const receipt = receipts.get(call.id)
    if (receipt === undefined && answered.has(call.id)) return []
    const notification = ended.get(call.id)
    return [
      {
        id: call.id,
        command: executable.command,
        label: executable.label,
        background: receipt !== undefined || executable.background,
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

function callActivity(call: ToolCall, open: boolean): SessionActivity {
  const { label, kind } = toolPresentation(call)
  return { label, kind, open, tool: call.name, target: toolTarget(call) }
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
