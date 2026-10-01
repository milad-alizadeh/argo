import type { TaskCreateInput, TaskUpdateInput } from '@anthropic-ai/claude-agent-sdk/sdk-tools'
import { z } from 'zod'
import { type FeedContent, planContent } from '@/domains/sessions/api/feed-content'
import { TERMINAL_DELEGATION_STATUSES } from './claude-feed-envelopes'

type Delegation = Extract<FeedContent, { kind: 'delegation' }>
type Tool = Extract<FeedContent, { kind: 'tool' }>
type FileChange = Extract<FeedContent, { kind: 'fileChange' }>
type KnownCall = { call: Tool; delegation: Delegation | null }
type PlanStep = { text: string; done: boolean }

const AGENT_TOOLS = new Set(['Agent', 'Task'])
// The launch or reply text of an Agent call names the id its transcript is stored under.
const AGENT_ID = /^agentId: ([\w-]+)/m
const ASYNC_LAUNCH = 'Async agent launched'
// A TodoWrite call states the whole Plan each time; one it cannot read stays a tool row.
const todoInputSchema = z.object({
  todos: z.array(
    z.object({ content: z.string(), status: z.enum(['pending', 'in_progress', 'completed']) }),
  ),
})
// TaskCreate and TaskUpdate change one task each, so the Plan is the tasks held so far.
const taskCreateSchema = z.object({ subject: z.string() }) satisfies z.ZodType<
  Pick<TaskCreateInput, 'subject'>
>
const taskUpdateSchema = z.object({
  taskId: z.string(),
  subject: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'deleted']).optional(),
}) satisfies z.ZodType<Pick<TaskUpdateInput, 'taskId' | 'subject' | 'status'>>
// getSessionMessages drops tool_use_result, so history and the live stream both read the new
// task's id from its result text: "Task #1 created successfully: <subject>".
const TASK_CREATED = /^Task #(\S+) created/

function inputField(input: Tool['input'], key: string): string | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function resultText(content: Tool): string {
  return (content.output ?? [])
    .flatMap((part) => (part.kind === 'text' ? [part.text] : []))
    .join('\n')
}

function resultStatus(content: Tool, text: string): Delegation['status'] {
  if (content.status === 'failed') return 'failed'
  return text.startsWith(ASYNC_LAUNCH) ? 'running' : 'completed'
}

const prefixed = (prefix: '+' | '-', text: string) =>
  text === '' ? [] : text.split('\n').map((line) => `${prefix}${line}`)

// An Edit or Write names its file and text in its input, so its diff is known before it runs.
// The input states no line numbers, so an Edit's diff carries no hunk header.
function fileChange(content: Tool): FileChange | null {
  const path = inputField(content.input, 'file_path')
  if (path === null) return null
  const written = content.name === 'Write' ? inputField(content.input, 'content') : null
  if (written !== null)
    return {
      id: content.callId,
      kind: 'fileChange',
      status: 'running',
      changes: [{ path, change: 'add', diff: written }],
    }
  const removed = inputField(content.input, 'old_string')
  const added = inputField(content.input, 'new_string')
  if (content.name !== 'Edit' || removed === null || added === null) return null
  const diff = [...prefixed('-', removed), ...prefixed('+', added)].join('\n')
  return {
    id: content.callId,
    kind: 'fileChange',
    status: 'running',
    changes: [{ path, change: 'update', diff }],
  }
}

// A foreground Agent's result is its reply, followed by the id line and usage the tool appends.
function replyText(text: string): string | null {
  const idLine = text.match(AGENT_ID)?.index ?? text.length
  const reply = text.slice(0, idLine).trim()
  return reply === '' ? null : reply
}

// Pairs each Agent call with its Subagent across one stream. A skill row names the skill only,
// and a TodoWrite, TaskCreate or TaskUpdate call is a Plan; neither draws its result.
export class ClaudeFeedProjection {
  private calls = new Map<string, KnownCall>()
  // The last input each started agent was sent.
  private startedAgents = new Map<string, string | null>()
  private quietCalls = new Set<string>()
  private fileChanges = new Map<string, FileChange>()
  private taskCreates = new Map<string, { call: Tool; subject: string }>()
  private tasks = new Map<string, PlanStep>()

  project(content: FeedContent): FeedContent[] {
    switch (content.kind) {
      case 'tool':
        return this.tool(content)
      case 'task':
        return this.task(content)
      case 'delegation':
        return this.delegation(content)
      default:
        return [content]
    }
  }

  // A repeated envelope for a started agent is a message only when its input is new; the same
  // input again is a progress report, which no event records.
  private delegation(content: Delegation): Delegation[] {
    const repeated = content.event === 'started' && this.startedAgents.has(content.agentId)
    if (repeated && this.startedAgents.get(content.agentId) === content.prompt) return []
    if (content.event !== 'responded') this.startedAgents.set(content.agentId, content.prompt)
    return [repeated ? { ...content, event: 'messaged' } : content]
  }

  private tool(content: Tool): FeedContent[] {
    if (content.input !== null) return this.call(content)
    const create = this.taskCreates.get(content.callId)
    if (create !== undefined) return this.taskCreated(create, content)
    if (this.quietCalls.has(content.callId)) return []
    const edit = this.fileChanges.get(content.callId)
    if (edit !== undefined) return [{ ...edit, status: content.status }]
    const known = this.calls.get(content.callId)
    if (known === undefined) return [content]
    if (known.delegation !== null)
      return content.status === 'failed' ? this.update(known, 'failed', null) : []
    const text = resultText(content)
    const agentId = text.match(AGENT_ID)?.[1]
    if (agentId === undefined) return [known.call, content]
    const started = this.start(known, agentId)
    const status = resultStatus(content, text)
    // A foreground Agent's one result is both its start and its reply.
    return TERMINAL_DELEGATION_STATUSES.has(status)
      ? [started, ...this.update(known, status, replyText(text))]
      : [started]
  }

  private call(content: Tool): FeedContent[] {
    const edit = fileChange(content)
    if (edit !== null) {
      this.fileChanges.set(content.callId, edit)
      return [edit]
    }
    const skill = content.name === 'Skill' ? inputField(content.input, 'skill') : null
    if (skill !== null && skill !== '') {
      this.quietCalls.add(content.callId)
      return [
        {
          id: content.id,
          kind: 'reference',
          referenceType: 'skill',
          label: skill,
          target: null,
          text: inputField(content.input, 'args'),
        },
      ]
    }
    const plan = this.planCall(content)
    if (plan !== null) return plan
    if (
      !AGENT_TOOLS.has(content.name) ||
      content.input === null ||
      typeof content.input !== 'object' ||
      Array.isArray(content.input)
    )
      return [content]
    this.calls.set(content.callId, { call: content, delegation: null })
    return []
  }

  // A TodoWrite, TaskCreate or TaskUpdate call it can read is a Plan, or the start of one.
  private planCall(content: Tool): FeedContent[] | null {
    const todos = content.name === 'TodoWrite' ? todoInputSchema.safeParse(content.input) : null
    if (todos?.success) {
      this.quietCalls.add(content.callId)
      const steps = todos.data.todos.map((todo) => ({
        text: todo.content,
        done: todo.status === 'completed',
      }))
      return [planContent(content.id, steps)]
    }
    const create = content.name === 'TaskCreate' ? taskCreateSchema.safeParse(content.input) : null
    if (create?.success) {
      this.taskCreates.set(content.callId, { call: content, subject: create.data.subject })
      return []
    }
    const update = content.name === 'TaskUpdate' ? taskUpdateSchema.safeParse(content.input) : null
    const task = update?.success ? this.tasks.get(update.data.taskId) : undefined
    if (update?.success && task !== undefined) {
      this.quietCalls.add(content.callId)
      const { taskId, subject, status } = update.data
      if (status === 'deleted') this.tasks.delete(taskId)
      else
        this.tasks.set(taskId, {
          text: subject ?? task.text,
          done: status === undefined ? task.done : status === 'completed',
        })
      return [planContent(content.id, [...this.tasks.values()])]
    }
    return null
  }

  // A create the CLI refused, or whose id it cannot read, stays the tool call it is.
  private taskCreated(create: { call: Tool; subject: string }, result: Tool): FeedContent[] {
    if (result.status === 'running') return []
    this.taskCreates.delete(create.call.callId)
    const taskId = resultText(result).match(TASK_CREATED)?.[1]
    if (result.status === 'failed' || taskId === undefined) return [create.call, result]
    this.quietCalls.add(create.call.callId)
    this.tasks.set(taskId, { text: create.subject, done: false })
    return [planContent(result.id, [...this.tasks.values()])]
  }

  private task(content: Extract<FeedContent, { kind: 'task' }>): FeedContent[] {
    const known =
      [...this.calls.values()].find(({ delegation }) => delegation?.agentId === content.taskId) ??
      (content.callId === null ? undefined : this.calls.get(content.callId))
    if (known === undefined) return [content]
    const status = content.status ?? 'running'
    if (known.delegation !== null) return this.update(known, status, content.summary)
    const started = this.start(known, content.taskId)
    return TERMINAL_DELEGATION_STATUSES.has(status)
      ? [started, ...this.update(known, status, content.summary)]
      : [started]
  }

  private start(known: KnownCall, agentId: string): Delegation {
    this.startedAgents.set(agentId, inputField(known.call.input, 'prompt'))
    known.delegation = {
      id: known.call.callId,
      kind: 'delegation',
      event: 'started',
      agentId,
      status: 'running',
      name:
        inputField(known.call.input, 'description') ??
        inputField(known.call.input, 'subagent_type'),
      prompt: inputField(known.call.input, 'prompt'),
      model: inputField(known.call.input, 'model'),
      summary: null,
    }
    return known.delegation
  }

  // An end is its own response record; a running update records no event, so the start stays as sent.
  private update(
    known: KnownCall,
    status: Delegation['status'],
    summary: string | null,
  ): Delegation[] {
    const started = known.delegation
    if (started === null) throw new Error('A Subagent update came before its start.')
    if (!TERMINAL_DELEGATION_STATUSES.has(status)) return []
    return [
      {
        ...started,
        id: `${started.id}:response`,
        event: 'responded',
        status,
        prompt: null,
        summary,
      },
    ]
  }
}
