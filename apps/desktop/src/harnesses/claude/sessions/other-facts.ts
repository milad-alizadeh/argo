import { skillTitle } from '@/domains/sessions/contract/model/feed/tool-feed'
import { mcpOther } from '@/domains/sessions/contract/model/mcp-call'
import type {
  OtherFacts,
  SkillFacts,
} from '@/domains/sessions/contract/model/transcript/transcript'

type Input = Record<string, unknown>
type SkillOrOther = SkillFacts | OtherFacts

// Poll and wait calls: they read a task the Feed already drew, so they draw no row.
export const POLL_TOOLS = new Set(['TaskOutput', 'Monitor'])

// Orchestration tools, each with the words its row says.
const ORCHESTRATION_LABELS: Record<string, string> = {
  ToolSearch: 'Searched tools',
  ScheduleWakeup: 'Scheduled a wake-up',
  TodoWrite: 'Updated the plan',
  TaskCreate: 'Updated the plan',
  TaskUpdate: 'Updated the plan',
  EnterPlanMode: 'Entered plan mode',
  ExitPlanMode: 'Left plan mode',
  EnterWorktree: 'Entered a worktree',
  ExitWorktree: 'Left a worktree',
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function inputText(input: Input): string | null {
  const values = Object.values(input)
  const only = values.length === 1 && typeof values[0] === 'string' ? values[0] : null
  return only ?? (values.length === 0 ? null : JSON.stringify(input, null, 2))
}

export function skillOrOtherFacts(name: string, input: Input): SkillOrOther | null {
  if (name === 'Skill') {
    const slug = text(input.skill)
    return { kind: 'skill', title: slug === null ? null : skillTitle(slug) }
  }
  const mcp = mcpOther(name)
  if (mcp !== null) return { ...mcp, text: null }
  const label = Object.hasOwn(ORCHESTRATION_LABELS, name) ? ORCHESTRATION_LABELS[name] : undefined
  return {
    kind: 'other',
    label: text(input.title) ?? label ?? `Ran ${name}`,
    text: inputText(input),
    source: null,
  }
}
