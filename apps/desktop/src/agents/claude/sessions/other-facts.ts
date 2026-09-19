import { skillTitle } from '../../../domains/sessions/contract/tool-feed'
import type { ToolCall } from '../../../domains/sessions/contract/transcript'

type Input = Record<string, unknown>
type OtherFacts = Pick<ToolCall, 'skill' | 'other'>

// A Claude tool that another module already turns into a row, a Plan change, a Subagent or the end
// of a background command. It arrives here unclassified and stays so.
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

// `mcp__<server>__<tool>`; a tool name may hold `__` itself, so only the first split counts.
const MCP_NAME = /^mcp__([^_](?:[^_]|_(?!_))*)__(.+)$/

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function otherFacts(name: string, input: Input): OtherFacts {
  if (name === 'Skill') {
    const slug = text(input.skill)
    return { skill: { kind: 'skill', title: slug === null ? null : skillTitle(slug) } }
  }
  if (HANDLED_ELSEWHERE.has(name)) return {}
  const mcp = MCP_NAME.exec(name)
  if (mcp?.[1] !== undefined && mcp[2] !== undefined) {
    const source = { server: mcp[1], tool: mcp[2] }
    return { other: { kind: 'other', label: `${source.server} · ${source.tool}`, source } }
  }
  const label = Object.hasOwn(ORCHESTRATION_LABELS, name) ? ORCHESTRATION_LABELS[name] : undefined
  return {
    other: { kind: 'other', label: label ?? text(input.title) ?? `Ran ${name}`, source: null },
  }
}
