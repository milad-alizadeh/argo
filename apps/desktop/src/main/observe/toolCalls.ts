import {
  PLAN_ENTRY_STATUSES,
  type Plan,
  type PlanEntry,
  type PlanEntryStatus,
  type ToolCall,
  type ToolCallKind,
} from '../../shared'
import { asArray, asString, isRecord, stringField } from './untrusted'

// One `tool_use` content part becomes one Tool Call. The host's tool NAME travels verbatim; the
// coarse `kind` beside it is what makes the record CLI-agnostic. A name this table does not know
// reads as `other` — never as a guessed kind.

const KIND_BY_NAME: Readonly<Record<string, ToolCallKind>> = {
  Read: 'read',
  NotebookRead: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Bash: 'execute',
  BashOutput: 'execute',
  KillShell: 'execute',
  Grep: 'search',
  Glob: 'search',
  WebFetch: 'fetch',
  WebSearch: 'fetch',
  Task: 'delegate',
  Agent: 'delegate',
  Workflow: 'delegate',
  TodoWrite: 'plan',
  ExitPlanMode: 'plan',
}

/** The tool names that delegate work to a Subagent — the one place a child Agent is born. */
export const DELEGATING_TOOLS: readonly string[] = ['Task', 'Agent']

/** The tool whose input IS the Plan. */
export const PLAN_TOOL = 'TodoWrite'

/** The structured question whose pending state is the only honest `asking` signal. */
export const ASK_TOOL = 'AskUserQuestion'

export function toolCallKind(name: string): ToolCallKind {
  return KIND_BY_NAME[name] ?? 'other'
}

// The one field worth naming for the kinds that name something. Read in order because a tool
// carries at most one of these; nothing is synthesized when it carries none.
const TARGET_KEYS = ['file_path', 'path', 'command', 'pattern', 'url', 'description'] as const

export function toolCallTarget(input: unknown): string | null {
  for (const key of TARGET_KEYS) {
    const value = stringField(input, key)
    if (value !== null) return value
  }
  return null
}

/**
 * A `tool_use` part → a pending Tool Call. Pending is the honest opening state: the matching
 * `tool_result` has not been read yet, and it may never arrive (the turn was interrupted).
 */
export function toolCallFrom(part: unknown): ToolCall | null {
  if (!isRecord(part) || part.type !== 'tool_use') return null
  const id = asString(part.id)
  const name = asString(part.name)
  if (id === null || name === null) return null
  return {
    id,
    name,
    kind: toolCallKind(name),
    status: 'pending',
    target: toolCallTarget(part.input),
  }
}

function planEntryStatus(value: unknown): PlanEntryStatus {
  const raw = asString(value)
  return PLAN_ENTRY_STATUSES.find((status) => status === raw) ?? 'pending'
}

/** `TodoWrite`'s input → the Plan. An entry with no text is dropped rather than shown blank. */
export function planFrom(input: unknown): Plan | null {
  if (!isRecord(input)) return null
  const entries = asArray(input.todos).flatMap((todo): PlanEntry[] => {
    const text = stringField(todo, 'content')
    if (text === null) return []
    return [{ text, status: planEntryStatus(isRecord(todo) ? todo.status : null) }]
  })
  return entries.length === 0 ? null : { entries }
}

/**
 * A delegating `tool_use` → the Subagent it spawned. `label` and `group` are TIER-GATED and both
 * ABSENT unless the CLI reported them: the CLI's own `description` is the label, and `group` is
 * whatever grouping it named. **No transcript Argo can read carries a group today** — Claude
 * Code's phased runner does not write one into the record — so every CLI currently lands on the
 * labelled tier, which is the honest floor. The field is read rather than dropped because the
 * cockpit's job when a CLI DOES report grouping is to render it, and its job when one does not
 * is to say nothing: a phase is never invented to fill the gap.
 */
export function subagentFrom(call: ToolCall, input: unknown): SubagentSeed {
  const label = stringField(input, 'description')
  const group = stringField(input, 'group')
  return {
    id: call.id,
    ...(label === null ? {} : { label }),
    ...(group === null ? {} : { group }),
  }
}

/** The Subagent facts a parent's Turn can honestly carry: identity plus whatever it was told. */
export interface SubagentSeed {
  id: string
  label?: string
  group?: string
}
