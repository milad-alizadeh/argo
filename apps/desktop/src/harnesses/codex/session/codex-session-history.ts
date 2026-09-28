import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { CodexRequest } from '../app-server/codex-app-server-client'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'
import type { ThreadReadResponse } from '../app-server/protocol-generated/v2/thread-read-response'
import { codexCommandContent } from './codex-command-content'
import { codexSubagentContent } from './codex-subagent-content'

const textContentSchema = z.object({ type: z.literal('text'), text: z.string() }).passthrough()
type FileChangeStatus = Extract<ThreadItem, { type: 'fileChange' }>['status']
type AgentMessagePhase = NonNullable<Extract<ThreadItem, { type: 'agentMessage' }>['phase']>
type ImageGenerationFailure = NonNullable<
  Extract<ThreadItem, { type: 'imageGeneration' }>['failure']
>
export const codexMessagePhaseSchema = z.enum([
  'commentary',
  'final_answer',
]) satisfies z.ZodType<AgentMessagePhase>
const codexWorkStatusSchema = z.enum([
  'inProgress',
  'completed',
  'failed',
  'declined',
]) satisfies z.ZodType<FileChangeStatus>
function workStatus(
  status: z.infer<typeof codexWorkStatusSchema>,
): Extract<FeedContent, { kind: 'tool' }>['status'] {
  switch (status) {
    case 'inProgress':
      return 'running'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'declined':
      return 'interrupted'
  }
}
const threadItemRoles = {
  userMessage: 'user',
  hookPrompt: null,
  agentMessage: 'assistant',
  functionCallOutput: null,
  plan: null,
  reasoning: null,
  commandExecution: null,
  fileChange: null,
  mcpToolCall: null,
  dynamicToolCall: null,
  collabAgentToolCall: null,
  subAgentActivity: null,
  webSearch: null,
  imageView: null,
  sleep: null,
  imageGeneration: null,
  enteredReviewMode: null,
  exitedReviewMode: null,
  contextCompaction: null,
} satisfies Record<ThreadItem['type'], 'user' | 'assistant' | null>
export const codexThreadItemTypeSchema = z.enum(
  Object.keys(threadItemRoles) as [ThreadItem['type'], ...ThreadItem['type'][]],
)
const itemSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: codexThreadItemTypeSchema,
    content: z.array(z.unknown()).optional(),
    text: z.string().optional(),
    phase: codexMessagePhaseSchema.nullable().optional(),
    summary: z.array(z.string()).optional(),
  })
  .passthrough() satisfies z.ZodType<Pick<ThreadItem, 'type'> & Partial<Pick<ThreadItem, 'id'>>>
type ReadTurn = ThreadReadResponse['thread']['turns'][number]
const readTurnSchema = z
  .object({
    id: z.string().min(1).optional(),
    items: z.array(z.unknown()),
  })
  .passthrough() satisfies z.ZodType<Partial<Pick<ReadTurn, 'id'>> & { items: unknown[] }>
const threadSchema = z
  .object({
    turns: z.array(readTurnSchema),
  })
  .passthrough()
const responseSchema = z.object({ thread: threadSchema }).passthrough()

function itemText(item: z.infer<typeof itemSchema>): string | null {
  if (typeof item.text === 'string' && item.text.trim() !== '') return item.text
  const text = (item.content ?? [])
    .flatMap((block) => {
      const parsed = textContentSchema.safeParse(block)
      return parsed.success ? [parsed.data.text] : []
    })
    .join('\n')
    .trim()
  return text === '' ? null : text
}

type ParsedItem = z.infer<typeof itemSchema>
type IdentifiedItem = ParsedItem & { id: string }

function messageItemContent(item: IdentifiedItem): FeedContent | null {
  const role = threadItemRoles[item.type]
  const text = itemText(item)
  if (role === null || text === null) return null
  return {
    kind: 'message',
    id: item.id,
    role,
    text,
    ...(item.type === 'agentMessage' && item.phase !== undefined ? { phase: item.phase } : {}),
  }
}

function simpleItemContent(item: IdentifiedItem, raw: unknown): FeedContent | null {
  switch (item.type) {
    case 'reasoning': {
      const summary = item.summary?.join('\n').trim() ?? ''
      return { kind: 'reasoning', id: item.id, text: summary || null, redacted: false }
    }
    case 'contextCompaction':
      return { kind: 'marker', id: item.id, marker: 'compaction', summary: null }
    case 'enteredReviewMode':
    case 'exitedReviewMode':
      return {
        kind: 'marker',
        id: item.id,
        marker: item.type === 'enteredReviewMode' ? 'reviewStarted' : 'reviewEnded',
        summary: null,
      }
    case 'plan':
      return item.text === undefined ? null : { kind: 'plan', id: item.id, text: item.text }
    case 'sleep': {
      const sleep = z.object({ durationMs: z.number().int().nonnegative() }).safeParse(raw)
      return sleep.success ? { kind: 'wait', id: item.id, durationMs: sleep.data.durationMs } : null
    }
    case 'imageView': {
      const image = z.object({ path: z.string().min(1) }).safeParse(raw)
      return image.success
        ? {
            kind: 'media',
            id: item.id,
            mediaType: 'image',
            source: { kind: 'path', path: image.data.path },
            role: null,
          }
        : null
    }
    default:
      return messageItemContent(item)
  }
}

function fileChangeContent(id: string, raw: unknown): FeedContent {
  type FileKind = Extract<ThreadItem, { type: 'fileChange' }>['changes'][number]['kind']['type']
  const kindSchema = z.enum(['add', 'update', 'delete']) satisfies z.ZodType<FileKind>
  const file = z
    .object({
      status: codexWorkStatusSchema,
      changes: z.array(
        z.object({
          path: z.string(),
          diff: z.string().optional(),
          kind: z.object({ type: kindSchema }),
        }),
      ),
    })
    .parse(raw)
  return {
    kind: 'fileChange',
    id,
    status: workStatus(file.status),
    changes: file.changes.map((change) => ({
      path: change.path,
      change: change.kind.type,
      diff: change.diff ?? null,
    })),
  }
}

function toolCallContent(id: string, raw: unknown): FeedContent {
  const tool = z
    .object({
      tool: z.string(),
      server: z.string().optional(),
      status: codexWorkStatusSchema,
      arguments: z.unknown().optional(),
      result: z
        .object({ content: z.array(z.unknown()) })
        .nullable()
        .optional(),
      contentItems: z.array(z.unknown()).nullable().optional(),
    })
    .parse(raw)
  const output = (tool.result?.content ?? tool.contentItems ?? []).flatMap((part) => {
    const text = textContentSchema.safeParse(part)
    if (text.success) return [{ kind: 'text' as const, text: text.data.text }]
    const inputText = z.object({ type: z.literal('inputText'), text: z.string() }).safeParse(part)
    return inputText.success ? [{ kind: 'text' as const, text: inputText.data.text }] : []
  })
  const name = tool.server === undefined ? tool.tool : `${tool.server}/${tool.tool}`
  return {
    kind: 'tool',
    id,
    callId: id,
    name,
    status: workStatus(tool.status),
    input: z.json().safeParse(tool.arguments).data ?? null,
    output: output.length === 0 ? null : output,
    summary: null,
    presentation: { kind: 'tool', label: name },
  }
}

function searchContent(id: string, raw: unknown): FeedContent | null {
  type SearchAction = NonNullable<Extract<ThreadItem, { type: 'webSearch' }>['action']>['type']
  const actionSchema = z.enum([
    'search',
    'openPage',
    'findInPage',
    'other',
  ]) satisfies z.ZodType<SearchAction>
  const search = z
    .object({
      query: z.string().optional(),
      action: z.object({ type: actionSchema }).nullable().optional(),
    })
    .safeParse(raw)
  return search.success
    ? {
        kind: 'search',
        id,
        query: search.data.query ?? '',
        action: search.data.action?.type ?? null,
        results: [],
      }
    : null
}

const imageGenerationFailureSchema = z.object({
  type: z.literal('usageLimitExceeded'),
  limitId: z.string(),
  resetsAt: z.number().int().nullable().default(null),
}) satisfies z.ZodType<ImageGenerationFailure>

function imageGenerationFailureText(failure: ImageGenerationFailure | null): string | null {
  if (failure === null) return null
  switch (failure.type) {
    case 'usageLimitExceeded': {
      const text = 'Image generation usage limit exceeded.'
      if (failure.resetsAt === null) return text
      const reset = new Date(failure.resetsAt * 1000)
      return Number.isFinite(reset.getTime())
        ? `Image generation usage limit exceeded. Resets at ${reset.toISOString()}.`
        : text
    }
  }
}

function imageGenerationContent(id: string, raw: unknown): FeedContent {
  const generated = z
    .object({
      status: z.string(),
      revisedPrompt: z.string().nullable().optional(),
      savedPath: z.string().nullable().optional(),
      failure: imageGenerationFailureSchema.nullable().optional(),
    })
    .parse(raw)
  let status: Extract<FeedContent, { kind: 'imageGeneration' }>['status'] = 'running'
  if (generated.status === 'completed') status = 'completed'
  if (generated.status === 'failed') status = 'failed'
  return {
    kind: 'imageGeneration',
    id,
    status,
    prompt: generated.revisedPrompt ?? null,
    source: generated.savedPath == null ? null : { kind: 'path', path: generated.savedPath },
    failure: imageGenerationFailureText(generated.failure ?? null),
  }
}

function codexItemContent(raw: unknown, fallbackId: string): FeedContent | null {
  const parsed = itemSchema.parse(raw)
  const item = { ...parsed, id: parsed.id ?? fallbackId }
  switch (item.type) {
    case 'commandExecution': {
      const command = codexCommandContent(raw, 'completed')
      if (command === null) throw new Error('Invalid Codex commandExecution history item')
      return command
    }
    case 'fileChange':
      return fileChangeContent(item.id, raw)
    case 'mcpToolCall':
    case 'dynamicToolCall':
      return toolCallContent(item.id, raw)
    case 'webSearch':
      return searchContent(item.id, raw)
    case 'imageGeneration':
      return imageGenerationContent(item.id, raw)
    case 'subAgentActivity': {
      const delegation = codexSubagentContent(raw)
      if (delegation === null) throw new Error('Invalid Codex subAgentActivity history item')
      return delegation
    }
    case 'collabAgentToolCall':
      return null
    default:
      return simpleItemContent(item, raw)
  }
}

export function codexContentFromItems(items: unknown[], fallbackPrefix = 'item'): FeedContent[] {
  return items.flatMap((raw, itemIndex) => {
    const content = codexItemContent(raw, `${fallbackPrefix}:${itemIndex}`)
    return content === null ? [] : [content]
  })
}

export async function readCodexSessionHistory(
  request: CodexRequest,
  nativeId: string,
): Promise<FeedContent[]> {
  const response = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => responseSchema.parse(value),
  )
  const content: FeedContent[] = []
  response.thread.turns.forEach((turn, turnIndex) => {
    content.push(...codexContentFromItems(turn.items, `${nativeId}:${turn.id ?? turnIndex}`))
  })
  return content
}

export async function hasCodexSessionTurn(
  request: CodexRequest,
  nativeId: string,
  turnId: string,
): Promise<boolean> {
  const response = await request(
    'thread/read',
    { threadId: nativeId, includeTurns: true },
    (value) => responseSchema.parse(value),
  )
  return response.thread.turns.some((turn) => turn.id === turnId)
}
