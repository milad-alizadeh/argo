import { questionSchema } from '@/domains/sessions/contract/drive'
import { mcpOther, skillTitle } from '@/domains/sessions/contract/model'
import type {
  AskFacts,
  EditedFile,
  EditFacts,
  ExecuteFacts,
  FetchFacts,
  OtherFacts,
  ReadFacts,
  SearchFacts,
  SkillFacts,
} from '@/domains/sessions/contract/model'
import { createdPatch, unifiedPatch } from '@/domains/sessions/contract/model'

const ASK_TOOL = 'AskUserQuestion'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

// Claude's `AskUserQuestion` input carries the structured questions verbatim.
export function askFacts(name: string, input: Record<string, unknown>): AskFacts | null {
  if (name !== ASK_TOOL || !Array.isArray(input.questions)) return null
  const questions = input.questions.map((question) => questionSchema.safeParse(question))
  if (questions.length === 0 || questions.some((question) => !question.success)) return null
  return {
    kind: 'ask',
    questions: questions.flatMap((question) => (question.success ? [question.data] : [])),
    unsupported: null,
  }
}

// Claude's `Bash` call as the domain's `execute` Tool Call (CONTEXT.md L3 · Tool Call).
export function bashFacts(input: Record<string, unknown>): ExecuteFacts {
  const command = text(input.command)
  return {
    kind: 'execute',
    command: command?.trim().split('\n', 1).join('') ?? null,
    label: text(input.label) ?? text(input.description),
    text: command,
    background: input.run_in_background === true,
  }
}

type EditInput = Record<string, unknown>

const lineCount = (value: string) => value.split('\n').length

const singleEdit = (file: EditedFile): EditFacts => ({ kind: 'edit', files: [file] })

// Claude records an edit's old and new text, so its diff is known before the result lands.
function edit(input: EditInput): EditFacts {
  const oldText = text(input.old_string)
  const newText = text(input.new_string)
  return singleEdit({
    change: 'update',
    file: text(input.file_path),
    diff: oldText === null || newText === null ? '' : unifiedPatch(oldText, newText),
    lineCounts: {
      added: newText === null ? 0 : lineCount(newText),
      removed: oldText === null ? 0 : lineCount(oldText),
    },
  })
}

function write(input: EditInput): EditFacts {
  const content = text(input.content)
  return singleEdit({
    change: 'create',
    file: text(input.file_path),
    diff: content === null ? '' : createdPatch(content),
    lineCounts: { added: content === null ? 0 : lineCount(content), removed: 0 },
  })
}

// A notebook cell change is an update of the notebook; deleting a cell adds no lines.
function notebookEdit(input: EditInput): EditFacts {
  const source = text(input.edit_mode) === 'delete' ? null : text(input.new_source)
  return singleEdit({
    change: 'update',
    file: text(input.notebook_path),
    diff: source === null ? '' : createdPatch(source),
    lineCounts: { added: source === null ? 0 : lineCount(source), removed: 0 },
  })
}

// Claude's file-changing tools as the domain's `edit` Tool Call (CONTEXT.md L3 · Tool Call).
const EDITS: Record<string, (input: EditInput) => EditFacts> = {
  Edit: edit,
  Write: write,
  NotebookEdit: notebookEdit,
}

export function editFacts(name: string, input: EditInput): EditFacts | null {
  const read = Object.hasOwn(EDITS, name) ? EDITS[name] : undefined
  return read === undefined ? null : read(input)
}

type LookupFacts = ReadFacts | SearchFacts | FetchFacts

// Claude's file, search and web tools as the domain's `read`, `search` and `fetch` Tool Calls
// (CONTEXT.md L3 · Tool Call), keyed by tool name.
const fileSearch = (input: Record<string, unknown>): LookupFacts => ({
  kind: 'search',
  scope: 'files',
  query: text(input.pattern),
})

const LOOKUPS: Record<string, (input: Record<string, unknown>) => LookupFacts> = {
  Read: (input) => ({ kind: 'read', target: text(input.file_path) }),
  Glob: fileSearch,
  Grep: fileSearch,
  WebSearch: (input) => ({ kind: 'search', scope: 'web', query: text(input.query) }),
  WebFetch: (input) => ({ kind: 'fetch', url: text(input.url) }),
}

export function lookupFacts(name: string, input: Record<string, unknown>): LookupFacts | null {
  const read = Object.hasOwn(LOOKUPS, name) ? LOOKUPS[name] : undefined
  return read === undefined ? null : read(input)
}

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

function inputText(input: EditInput): string | null {
  const values = Object.values(input)
  const only = values.length === 1 && typeof values[0] === 'string' ? values[0] : null
  return only ?? (values.length === 0 ? null : JSON.stringify(input, null, 2))
}

export function skillOrOtherFacts(name: string, input: EditInput): SkillOrOther | null {
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
