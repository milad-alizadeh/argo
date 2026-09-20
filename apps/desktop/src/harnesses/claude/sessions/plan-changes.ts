// The changes a Claude record makes to its Session's Plan (CONTEXT.md L3 · Plan). `TodoWrite`
// writes the whole list and older transcripts still carry it; current CLIs add one step with
// `TaskCreate` and change it with `TaskUpdate`, naming it by the id `TaskCreate`'s result gave.

import type { PlanChange, ToolResult } from '@/domains/sessions/contract/model/transcript'
import { readPlanSnapshot, readPlanStatus } from '@/domains/sessions/main/port'
import { isRecord } from '@/shared/validation'

const DELETED = 'deleted'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

type PlanCall = { id: string; name: string; input: Record<string, unknown> }

function readTodos(call: PlanCall): PlanChange {
  const todos = call.input.todos
  if (!Array.isArray(todos)) return { kind: 'unreadable' }
  return readPlanSnapshot(
    todos
      .map((todo) => (isRecord(todo) ? todo : {}))
      .map(({ content, status }) => ({ content, status })),
  )
}

// The Harness refuses a step with no subject, so such a call adds nothing.
function readCreate(call: PlanCall): PlanChange | null {
  const content = text(call.input.subject)
  return content === null ? null : { kind: 'add', callId: call.id, content }
}

function readUpdate(call: PlanCall): PlanChange | null {
  const key = text(call.input.taskId)
  if (key === null) return null
  if (call.input.status === DELETED) return { kind: 'remove', key }
  const status = call.input.status === undefined ? null : readPlanStatus(call.input.status)
  if (call.input.status !== undefined && status === null) return { kind: 'unreadable' }
  return { kind: 'update', key, content: text(call.input.subject), status }
}

const PLAN_TOOLS = new Map<string, (call: PlanCall) => PlanChange | null>([
  ['TodoWrite', readTodos],
  ['TaskCreate', readCreate],
  ['TaskUpdate', readUpdate],
])

// `toolUseResult` belongs to the whole record, so it names a step only where the record answers
// one call. Another tool's result may carry `task.id` too; the replay joins it to an add alone.
function readAdded(results: ToolResult[], toolUseResult: unknown): PlanChange[] {
  const [result, ...others] = results
  if (result === undefined || others.length > 0) return []
  const task = isRecord(toolUseResult) && isRecord(toolUseResult.task) ? toolUseResult.task : {}
  const key = text(task.id)
  return key === null ? [] : [{ kind: 'added', callId: result.callId, key }]
}

export function readPlanChanges(
  content: unknown,
  results: ToolResult[],
  toolUseResult: unknown,
): PlanChange[] {
  const calls = Array.isArray(content)
    ? content.flatMap((block): PlanCall[] =>
        isRecord(block) &&
        block.type === 'tool_use' &&
        typeof block.id === 'string' &&
        typeof block.name === 'string'
          ? [{ id: block.id, name: block.name, input: isRecord(block.input) ? block.input : {} }]
          : [],
      )
    : []
  const written = calls.flatMap((call) => {
    const change = PLAN_TOOLS.get(call.name)?.(call) ?? null
    return change === null ? [] : [change]
  })
  return [...written, ...readAdded(results, toolUseResult)]
}
