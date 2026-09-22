import { mcpOther } from '@/domains/sessions/contract/model/mcp-call'
import type { OtherFacts } from '@/domains/sessions/contract/model/transcript/transcript'

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

function inputText(input: Record<string, unknown>): string | null {
  const code = text(input.code)
  if (code !== null) return code
  const entries = Object.entries(input)
  const entry = entries[0]
  if (entry === undefined) return null
  const [, value] = entry
  return entries.length === 1 && typeof value === 'string' ? value : JSON.stringify(input, null, 2)
}

// Any call no other kind claimed is `other`, so a tool Argo has never seen still draws a row.
export function otherFacts(name: string, input: Record<string, unknown>): OtherFacts | null {
  const mcp = mcpOther(name)
  if (mcp !== null) return { ...mcp, text: null }
  const known = Object.hasOwn(ORCHESTRATION_LABELS, name) ? ORCHESTRATION_LABELS[name] : undefined
  return {
    kind: 'other',
    label: text(input.title) ?? known ?? `Ran ${name}`,
    text: inputText(input),
    source: null,
  }
}
