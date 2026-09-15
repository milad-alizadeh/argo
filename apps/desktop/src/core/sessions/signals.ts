// The facts the Roster row draws beside its status, read off the Session's own records: the
// Subagents it delegated to, what the open Turn is doing, and when that Turn began. The Plan is
// `plan.ts`'s. Every one is DERIVED from Tool Calls the transcript names, and each is absent
// rather than guessed where the records do not carry it (CONTEXT.md L1 · degrade down).

import type {
  SessionActivity,
  SessionDelegation,
  SessionSetup,
  SessionShellCommand,
} from './models'
import type { ToolCall, TranscriptMessage, TranscriptRecord } from './transcript'

export type BackgroundTask = Extract<TranscriptRecord, { kind: 'background-task' }>

// The tools that spawn a Subagent (CONTEXT.md L3 · Subagent). The CLI renamed `Task` to `Agent`,
// and a transcript written before the rename still names the old one.
const DELEGATING_TOOLS = ['Task', 'Agent']
// The tool that runs a shell command (CONTEXT.md L3 · Tool Call). A call whose result has not
// come back is a command still running, which is what the Shell list's Running group says.
const SHELL_TOOL = 'Bash'

// The one input field an activity names, in the order a call is likelier to carry it. A path is
// cut to its last segment, because the row is narrow and the deck head already draws the place.
const PATH_FIELDS = ['file_path', 'notebook_path', 'path']
const TEXT_FIELDS = ['pattern', 'command', 'url', 'description', 'query']

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

export function readDelegations(
  messages: TranscriptMessage[],
  notifications: BackgroundTask[],
): SessionDelegation[] {
  const answered = new Set(messages.flatMap((message) => message.answeredCalls))
  const times = callTimes(messages)
  const ended = endings(notifications)
  return calls(messages)
    .filter((call) => DELEGATING_TOOLS.includes(call.name))
    .map((call) => ({
      id: call.id,
      label: text(call.input.description),
      landed: answered.has(call.id),
      startedAt: times.started.get(call.id) ?? null,
      // A Subagent sent to the background answers its call at once with a receipt, so the
      // notification is what says when it actually stopped.
      endedAt: ended.get(call.id)?.timestamp ?? times.ended.get(call.id) ?? null,
    }))
}

function endings(notifications: BackgroundTask[]): Map<string, BackgroundTask> {
  return new Map(notifications.map((notification) => [notification.callId, notification]))
}

// The shell commands the Shell list draws. A foreground `Bash` call the transcript holds no result for
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
    .filter((call) => call.name === SHELL_TOOL)
    .flatMap((call) => {
      const receipt = receipts.get(call.id)
      if (receipt === undefined && answered.has(call.id)) return []
      const notification = ended.get(call.id)
      return [
        {
          id: call.id,
          command: text(call.input.command)?.trim().split('\n', 1).join('') ?? null,
          label: text(call.input.description),
          background: receipt !== undefined || call.input.run_in_background === true,
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

// Mode rides on the prompt; Model and Effort only on a reply, so an unanswered Turn has neither.
export function readSetup(messages: TranscriptMessage[]): SessionSetup {
  const prompt = lastPromptIndex(messages)
  const replies = messages.slice(prompt + 1).filter((message) => message.role === 'assistant')
  return {
    model: replies.findLast((reply) => reply.model !== null)?.model ?? null,
    effort: replies.findLast((reply) => reply.effort !== null)?.effort ?? null,
    mode: messages[prompt]?.mode ?? null,
  }
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

// The newest call since the prompt that opened the Turn. A call from an earlier Turn is what
// the Session did, not what it is doing, so a Turn that has made no call yet reads nothing.
export function readActivity(messages: TranscriptMessage[]): SessionActivity | null {
  const call = calls(messages.slice(lastPromptIndex(messages) + 1)).at(-1)
  return call === undefined ? null : { tool: call.name, target: readTarget(call.input) }
}
