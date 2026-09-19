import { mcpOther } from '../../../domains/sessions/contract/mcp-call'
import type { ToolCall } from '../../../domains/sessions/contract/transcript'

// `apply_patch` is an edit, and another module reads it.
const HANDLED_ELSEWHERE = new Set(['apply_patch'])

// Orchestration tools, each with the words its row says.
const ORCHESTRATION_LABELS: Record<string, string> = {
  js: 'Ran a script',
  update_plan: 'Updated the plan',
  update_goal: 'Updated the goal',
  create_goal: 'Set the goal',
  get_goal: 'Read the goal',
  request_user_input: 'Asked a question',
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function classified({ execute, read, search, fetch, skill, other }: ToolCall): boolean {
  return [execute, read, search, fetch, skill, other].some((facts) => facts !== undefined)
}

// Any call no other kind claimed is `other`, so a tool Argo has never seen still draws a row.
export function withOtherFacts(call: ToolCall): ToolCall {
  if (classified(call) || HANDLED_ELSEWHERE.has(call.name)) return call
  const mcp = mcpOther(call.name)
  if (mcp !== null) return { ...call, other: mcp }
  const known = Object.hasOwn(ORCHESTRATION_LABELS, call.name)
    ? ORCHESTRATION_LABELS[call.name]
    : undefined
  const label = text(call.input.title) ?? known ?? `Ran ${call.name}`
  return { ...call, other: { kind: 'other', label, source: null } }
}
