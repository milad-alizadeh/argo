import { mcpOther } from '../../../domains/sessions/contract/mcp-call'
import { skillTitle } from '../../../domains/sessions/contract/tool-feed'
import type { ToolCall } from '../../../domains/sessions/contract/transcript'

type Input = Record<string, unknown>
type SkillOrOther = Pick<ToolCall, 'skill' | 'other'>

// Claude tools another module already reads as a row, a Plan change, a Subagent or a stop.
const HANDLED_ELSEWHERE = new Set([
  'Bash',
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Edit',
  'Write',
  'NotebookEdit',
  'AskUserQuestion',
  'Task',
  'Agent',
  'SendMessage',
  'TaskStop',
  'KillShell',
])

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

export function skillOrOtherFacts(name: string, input: Input): SkillOrOther {
  if (name === 'Skill') {
    const slug = text(input.skill)
    return { skill: { kind: 'skill', title: slug === null ? null : skillTitle(slug) } }
  }
  if (HANDLED_ELSEWHERE.has(name)) return {}
  const mcp = mcpOther(name)
  if (mcp !== null) return { other: mcp }
  const label = Object.hasOwn(ORCHESTRATION_LABELS, name) ? ORCHESTRATION_LABELS[name] : undefined
  return {
    other: { kind: 'other', label: text(input.title) ?? label ?? `Ran ${name}`, source: null },
  }
}
