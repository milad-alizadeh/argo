// The facts the Roster row draws beside its status, read off the Session's own records: the
// Subagents it delegated to, its Plan, what the open Turn is doing, and when that Turn began.
// Every one is DERIVED from Tool Calls the transcript names, and each is absent rather than
// guessed where the records do not carry it (CONTEXT.md L1 · degrade down).

import type { SessionActivity, SessionDelegation, SessionPlan, SessionShellCommand } from './models'
import type { ToolCall, TranscriptMessage } from './transcript'

// The tools that spawn a Subagent (CONTEXT.md L3 · Subagent). The CLI renamed `Task` to `Agent`,
// and a transcript written before the rename still names the old one.
const DELEGATING_TOOLS = ['Task', 'Agent']
// The tool that runs a shell command (CONTEXT.md L3 · Tool Call). A call whose result has not
// come back is a command still running, which is what the rail's Shell section says.
const SHELL_TOOL = 'Bash'
// The tool whose input is the Plan (CONTEXT.md L3 · Plan). Each call writes the whole list, so
// the newest one is the Plan and every earlier one is history.
const PLAN_TOOL = 'TodoWrite'
const PLAN_STATUSES = ['pending', 'in_progress', 'completed']

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

export function readDelegations(messages: TranscriptMessage[]): SessionDelegation[] {
  const answered = new Set(messages.flatMap((message) => message.answeredCalls))
  return calls(messages)
    .filter((call) => DELEGATING_TOOLS.includes(call.name))
    .map((call) => ({
      id: call.id,
      label: text(call.input.description),
      landed: answered.has(call.id),
    }))
}

// The shell commands running now: `Bash` calls the transcript holds no result for. A command that
// finished is what the Session did rather than what it is doing, so it is not read at all, and the
// count in the rail's header is therefore only ever what is running (#1907).
export function readShellCommands(messages: TranscriptMessage[]): SessionShellCommand[] {
  const answered = new Set(messages.flatMap((message) => message.answeredCalls))
  return calls(messages)
    .filter((call) => call.name === SHELL_TOOL && !answered.has(call.id))
    .map((call) => ({
      id: call.id,
      command: text(call.input.command)?.trim().split('\n', 1).join('') ?? null,
      background: call.input.run_in_background === true,
    }))
}

function isPlanEntry(value: unknown): value is { status: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    PLAN_STATUSES.includes((value as { status?: unknown }).status as string)
  )
}

// A snapshot with an entry this reader cannot place is skipped whole rather than counted in part,
// so the bar never draws a total the agent did not write.
export function readPlan(messages: TranscriptMessage[]): SessionPlan | null {
  const snapshot = calls(messages)
    .filter((call) => call.name === PLAN_TOOL)
    .map((call) => call.input.todos)
    .findLast((todos) => Array.isArray(todos) && todos.length > 0 && todos.every(isPlanEntry))
  if (snapshot === undefined) return null
  const statuses = (snapshot as { status: string }[]).map((entry) => entry.status)
  return {
    total: statuses.length,
    completed: statuses.filter((status) => status === 'completed').length,
    inProgress: statuses.filter((status) => status === 'in_progress').length,
  }
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

// The newest call since the prompt that opened the Turn. A call from an earlier Turn is what
// the Session did, not what it is doing, so a Turn that has made no call yet reads nothing.
export function readActivity(messages: TranscriptMessage[]): SessionActivity | null {
  const call = calls(messages.slice(lastPromptIndex(messages) + 1)).at(-1)
  return call === undefined ? null : { tool: call.name, target: readTarget(call.input) }
}
