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

// `mcp__<server>__<tool>`; a tool name may hold `__` itself, so only the first split counts.
const MCP_NAME = /^mcp__([^_](?:[^_]|_(?!_))*)__(.+)$/

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function classified({ execute, read, search, fetch, skill, other }: ToolCall): boolean {
  return [execute, read, search, fetch, skill, other].some((facts) => facts !== undefined)
}

// Any call no other kind claimed is `other`, so a tool Argo has never seen still draws a row.
export function withOtherFacts(call: ToolCall): ToolCall {
  if (classified(call) || HANDLED_ELSEWHERE.has(call.name)) return call
  const mcp = MCP_NAME.exec(call.name)
  if (mcp?.[1] !== undefined && mcp[2] !== undefined) {
    const source = { server: mcp[1], tool: mcp[2] }
    return { ...call, other: { kind: 'other', label: `${source.server} · ${source.tool}`, source } }
  }
  const known = Object.hasOwn(ORCHESTRATION_LABELS, call.name)
    ? ORCHESTRATION_LABELS[call.name]
    : undefined
  const label = text(call.input.title) ?? known ?? `Ran ${call.name}`
  return { ...call, other: { kind: 'other', label, source: null } }
}
