import {
  type FeedContent,
  type MediaSource,
  type PromptFile,
  planContent,
} from '@/domains/sessions/api/feed-content'
import type { JsonValue, ThreadItem, TurnPlanUpdatedNotification, UserInput } from '../app-server'
import { en as copy } from '../locales'
import { codexTaskNotification } from './codex-task-notification'

type Item<Type extends ThreadItem['type']> = Extract<ThreadItem, { type: Type }>
type Tool = Extract<FeedContent, { kind: 'tool' }>
type Reject = (vendorType: string) => void
// What the collab call behind a Subagent activity sent; it shares the activity's item id.
export type CodexCollabFacts = { prompt: string | null; model: string | null }

const WORK_STATUSES = {
  inProgress: 'running',
  completed: 'completed',
  failed: 'failed',
  declined: 'interrupted',
} as const
const MARKERS = {
  enteredReviewMode: 'reviewStarted',
  exitedReviewMode: 'reviewEnded',
  contextCompaction: 'compaction',
} as const
const ACTIVITIES = {
  started: ['started', 'running'],
  interacted: ['messaged', 'running'],
  interrupted: ['responded', 'interrupted'],
  completed: ['responded', 'completed'],
} as const

// A text part that is one whole placeholder names an attached file by its temporary path (#2884).
function attachment(part: Extract<UserInput, { type: 'text' }>): PromptFile | null {
  const [element, ...rest] = part.text_elements ?? []
  if (element === undefined || rest.length > 0 || element.placeholder === null) return null
  const { start, end } = element.byteRange
  if (start !== 0 || end !== Buffer.byteLength(part.text)) return null
  return { label: part.text.split('/').at(-1) ?? part.text, target: part.text }
}

// Codex names a skill twice: as a typed part, and as a Markdown link in the text the model reads.
function withoutLink(text: string, target: string): string {
  const close = text.indexOf(`](${target})`)
  const open = close < 0 ? -1 : text.lastIndexOf('[', close)
  if (open < 0) return text
  const after = close + target.length + 3
  const rest = text.slice(/[ \t]/.test(text[after] ?? '') ? after + 1 : after)
  return withoutLink(text.slice(0, open) + rest, target)
}

type PromptParts = { texts: string[]; images: MediaSource[]; files: PromptFile[] }

function promptParts(content: readonly UserInput[], reject: Reject): PromptParts {
  const parts: PromptParts = { texts: [], images: [], files: [] }
  for (const part of content) {
    const file = part.type === 'text' ? attachment(part) : null
    if (file !== null) parts.files.push(file)
    else if (part.type === 'text') parts.texts.push(part.text)
    else if (part.type === 'localImage') parts.images.push({ kind: 'path', path: part.path })
    else if (part.type === 'image' && 'url' in part)
      parts.images.push({ kind: 'url', url: part.url })
    else if (part.type === 'image') reject('image by fileId')
  }
  return parts
}

// A person's prompt: a skill row before it, as a Claude skill use draws, then the text with its files.
function promptContent(item: Item<'userMessage'>, reject: Reject): FeedContent[] {
  // An older thread item carries its text whole, outside `content`.
  const content = item.content ?? []
  const { texts, images, files } = promptParts(content, reject)
  const skills = content.flatMap((part) => (part.type === 'skill' ? [part] : []))
  const legacy = 'text' in item && typeof item.text === 'string' ? item.text : ''
  const joined = skills.reduce((text, skill) => withoutLink(text, skill.path), texts.join('\n'))
  const text = joined.trim() || legacy
  const task = codexTaskNotification(item.id, text, () => reject('task notification'))
  if (task !== null) return [task]
  const references = skills.map(({ name, path }, index): FeedContent => {
    const id = `${item.id}:skill:${index}`
    return { id, kind: 'reference', referenceType: 'skill', label: name, target: path, text: null }
  })
  if (text === '' && images.length === 0 && files.length === 0) return references
  const attached = {
    ...(images.length > 0 ? { images } : {}),
    ...(files.length > 0 ? { files } : {}),
  }
  return [...references, { id: item.id, kind: 'message', role: 'user', text, ...attached }]
}

// An MCP result is untyped JSON; only its text parts are read.
function mcpText(parts: readonly JsonValue[] | undefined): Tool['output'] {
  const output = (parts ?? []).flatMap((part) => {
    const { type, text } = (part ?? {}) as { type?: unknown; text?: unknown }
    return type === 'text' && typeof text === 'string' ? [{ kind: 'text' as const, text }] : []
  })
  return output.length === 0 ? null : output
}

function toolCall(item: Item<'mcpToolCall' | 'dynamicToolCall'>): Tool {
  const name = item.type === 'mcpToolCall' ? `${item.server}/${item.tool}` : item.tool
  const output =
    item.type === 'mcpToolCall'
      ? mcpText(item.result?.content)
      : (item.contentItems ?? []).flatMap((part) =>
          part.type === 'inputText' ? [{ kind: 'text' as const, text: part.text }] : [],
        )
  const call = { id: item.id, kind: 'tool', callId: item.id, summary: null } as const
  const presentation = { kind: 'tool', label: name } as const
  const input = item.arguments as Tool['input']
  return { ...call, name, status: WORK_STATUSES[item.status], input, output, presentation }
}

function fileChange(item: Item<'fileChange'>): FeedContent {
  const changes = item.changes.map(({ path, kind, diff }) => {
    const movedTo = kind.type === 'update' ? kind.move_path : null
    return { path, change: kind.type, diff: diff ?? null, ...(movedTo ? { movedTo } : {}) }
  })
  return { id: item.id, kind: 'fileChange', status: WORK_STATUSES[item.status], changes }
}

function delegation(item: Item<'subAgentActivity'>, reject: Reject, collab?: CodexCollabFacts) {
  const activity = (ACTIVITIES as Partial<typeof ACTIVITIES>)[item.kind]
  if (activity === undefined) return diagnostic(item.id, `subAgentActivity:${item.kind}`, reject)
  const [event, status] = activity
  const name = item.agentPath.split('/').filter(Boolean).at(-1) ?? null
  const { prompt = null, model = null } = collab ?? {}
  const facts = {
    id: item.id,
    kind: 'delegation',
    agentId: item.agentThreadId,
    summary: null,
  } as const
  return [{ ...facts, event, status, name, prompt, model }] satisfies FeedContent[]
}

function imageGeneration(item: Item<'imageGeneration'>, reject: Reject): FeedContent[] {
  const status = (WORK_STATUSES as Partial<Record<string, Tool['status']>>)[item.status]
  if (status === undefined) return diagnostic(item.id, `imageGeneration:${item.status}`, reject)
  const { failure, revisedPrompt, savedPath } = item
  const { usageLimitExceeded, usageLimitExceededWithReset } = copy.imageGeneration
  const reset = failure?.resetsAt == null ? null : new Date(failure.resetsAt * 1000)
  const failed =
    reset === null || !Number.isFinite(reset.getTime())
      ? usageLimitExceeded
      : usageLimitExceededWithReset.replace('{{resetTime}}', reset.toISOString())
  const source = savedPath == null ? null : ({ kind: 'path', path: savedPath } as const)
  const facts = { id: item.id, kind: 'imageGeneration', prompt: revisedPrompt ?? null } as const
  return [{ ...facts, status, source, failure: failure ? failed : null }]
}

function diagnostic(id: string, vendorType: string, reject: Reject): FeedContent[] {
  reject(vendorType)
  return [{ id, kind: 'diagnostic', vendorType, detail: 'Unsupported Codex thread item.' }]
}

// The one mapping from a Codex thread item to Feed content, for the live stream and the stored read.
export function codexFeedContent(
  item: ThreadItem,
  reject: Reject,
  collab?: CodexCollabFacts,
): FeedContent[] {
  const id = item.id
  switch (item.type) {
    case 'userMessage':
      return promptContent(item, reject)
    case 'agentMessage': {
      const { text, phase } = item
      return text === '' ? [] : [{ id, kind: 'message', role: 'assistant', text, phase }]
    }
    case 'reasoning': {
      const text = item.summary.join('\n').trim()
      return text === '' ? [] : [{ id, kind: 'reasoning', text }]
    }
    case 'plan':
      return [{ id, kind: 'plan', text: item.text }]
    case 'commandExecution': {
      // A declined command never ran, so it reads as failed rather than stopped.
      const status = item.status === 'declined' ? 'failed' : WORK_STATUSES[item.status]
      const { command, aggregatedOutput: output } = item
      return [{ id, kind: 'command', command, status, output, stderr: null }]
    }
    case 'fileChange':
      return [fileChange(item)]
    case 'mcpToolCall':
    case 'dynamicToolCall':
      return [toolCall(item)]
    case 'webSearch': {
      const presentation = { kind: 'searched', label: `Searched ${item.query}`.trim() } as const
      const fields = {
        name: 'webSearch',
        status: 'completed',
        input: { query: item.query },
      } as const
      return [
        { id, kind: 'tool', callId: id, ...fields, output: null, summary: null, presentation },
      ]
    }
    case 'subAgentActivity':
      return delegation(item, reject, collab)
    case 'imageView': {
      const source = { kind: 'path', path: item.path } as const
      return [{ id, kind: 'media', mediaType: 'image', source, role: null }]
    }
    case 'sleep':
      return [{ id, kind: 'wait', durationMs: item.durationMs }]
    case 'imageGeneration':
      return imageGeneration(item, reject)
    case 'enteredReviewMode':
    case 'exitedReviewMode':
    case 'contextCompaction':
      return [{ id, kind: 'marker', marker: MARKERS[item.type], summary: null }]
    // A hook's prompt and a raw call output are the model's input; a collab call joins its activity.
    case 'hookPrompt':
    case 'functionCallOutput':
    case 'collabAgentToolCall':
      return []
    default: {
      const unknown = item satisfies never as { id: string; type: string }
      return diagnostic(unknown.id, unknown.type, reject)
    }
  }
}

export function codexCollabFacts(items: readonly ThreadItem[]): Map<string, CodexCollabFacts> {
  const calls = items.filter((item) => item.type === 'collabAgentToolCall')
  return new Map(calls.map(({ id, prompt, model }) => [id, { prompt, model }]))
}

// A live Plan update states every step; history keeps none of them.
export function codexPlanContent(
  notification: TurnPlanUpdatedNotification,
): Extract<FeedContent, { kind: 'plan' }> {
  const steps = notification.plan.map(({ step, status }) => ({
    text: step,
    done: status === 'completed',
  }))
  return planContent(`${notification.turnId}:plan`, steps)
}

// A live agent message as its deltas and completion report it.
export type CodexMessageFacts = {
  itemId: string
  turnId: string
  role: 'user' | 'assistant'
  text: string
  phase?: 'commentary' | 'final_answer' | null
}

export function codexMessageContent(message: CodexMessageFacts): FeedContent {
  return {
    kind: 'message',
    id: message.itemId,
    role: message.role,
    text: message.text,
    ...(message.phase !== undefined ? { phase: message.phase } : {}),
  }
}
