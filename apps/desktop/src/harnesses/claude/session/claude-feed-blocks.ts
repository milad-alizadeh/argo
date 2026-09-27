import { z } from 'zod'
import type { FeedContent, MediaSource } from '@/domains/sessions/api/feed-content'
import { decodeClaudeText, type RejectClaudeShape } from './claude-feed-envelopes'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(z.unknown())]),
})
const blockTypeSchema = z.object({ type: z.string() })
const textSchema = z.object({ type: z.literal('text'), text: z.string() })
const thinkingSchema = z.object({ type: z.literal('thinking'), thinking: z.string() })
const toolUseSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string().min(1),
  name: z.string(),
  input: z.json(),
})
const toolResultSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string().min(1),
  content: z.union([z.string(), z.array(z.unknown())]).optional(),
  is_error: z.boolean().optional(),
})
const mediaSchema = z.object({
  type: z.enum(['image', 'document']),
  source: z.object({
    type: z.enum(['base64', 'url', 'text']),
    media_type: z.string().optional(),
    data: z.string().optional(),
    url: z.string().optional(),
  }),
})

type Role = 'user' | 'assistant'
type ToolPart = NonNullable<Extract<FeedContent, { kind: 'tool' }>['output']>[number]

function mediaSource(source: z.infer<typeof mediaSchema>['source']): MediaSource | null {
  if (source.type === 'url')
    return source.url === undefined ? null : { kind: 'url', url: source.url }
  if (source.type === 'text') return null
  if (source.media_type === undefined || source.data === undefined) return null
  return { kind: 'data', mimeType: source.media_type, base64: source.data }
}

function toolPart(raw: unknown, reject: RejectClaudeShape): ToolPart | null {
  const text = textSchema.safeParse(raw)
  if (text.success) return { kind: 'text', text: text.data.text }
  const media = mediaSchema.safeParse(raw)
  if (media.success && media.data.type === 'image') {
    const source = mediaSource(media.data.source)
    if (source !== null) return { kind: 'image', source }
  }
  reject('tool-result-part')
  return null
}

function toolResult(id: string, raw: unknown, reject: RejectClaudeShape): FeedContent | null {
  const parsed = toolResultSchema.safeParse(raw)
  if (!parsed.success) {
    reject('tool-result')
    return null
  }
  const output: ToolPart[] = []
  if (typeof parsed.data.content === 'string')
    output.push({ kind: 'text', text: parsed.data.content })
  else
    for (const part of parsed.data.content ?? []) {
      const decoded = toolPart(part, reject)
      if (decoded !== null) output.push(decoded)
    }
  return {
    id,
    kind: 'tool',
    callId: parsed.data.tool_use_id,
    name: '',
    status: parsed.data.is_error ? 'failed' : 'completed',
    input: null,
    output,
    summary: null,
  }
}

function mediaContent(
  input: { id: string; role: Role; raw: unknown },
  reject: RejectClaudeShape,
): FeedContent | null {
  const parsed = mediaSchema.safeParse(input.raw)
  if (!parsed.success) {
    reject('media-block')
    return null
  }
  const source = mediaSource(parsed.data.source)
  if (source === null && parsed.data.source.type !== 'text') {
    reject('media-source')
    return null
  }
  if (parsed.data.source.type === 'text') {
    if (parsed.data.type !== 'document' || parsed.data.source.data === undefined) {
      reject('document-text-source')
      return null
    }
    return {
      id: input.id,
      kind: 'reference',
      referenceType: 'pasted',
      label: 'Document text',
      target: null,
      text: parsed.data.source.data,
    }
  }
  if (source === null) return null
  return { id: input.id, kind: 'media', mediaType: parsed.data.type, source, role: input.role }
}

function decodeBlock(
  input: { id: string; role: Role; raw: unknown; vendorEnvelope: boolean },
  reject: RejectClaudeShape,
): FeedContent | null {
  const { id, role, raw, vendorEnvelope } = input
  const block = blockTypeSchema.safeParse(raw)
  if (!block.success) {
    reject('message-block')
    return null
  }
  switch (block.data.type) {
    case 'text': {
      const text = textSchema.safeParse(raw)
      if (!text.success) {
        reject('text-block')
        return null
      }
      return text.data.text.trim() === ''
        ? null
        : decodeClaudeText({ id, role, text: text.data.text, vendorEnvelope }, reject)
    }
    case 'thinking': {
      const thinking = thinkingSchema.safeParse(raw)
      if (!thinking.success) {
        reject('thinking-block')
        return null
      }
      return { id, kind: 'reasoning', text: thinking.data.thinking, redacted: false }
    }
    case 'redacted_thinking':
      return { id, kind: 'reasoning', text: null, redacted: true }
    case 'tool_use': {
      const tool = toolUseSchema.safeParse(raw)
      if (!tool.success) {
        reject('tool-use')
        return null
      }
      return {
        id,
        kind: 'tool',
        callId: tool.data.id,
        name: tool.data.name,
        status: 'running',
        input: tool.data.input,
        output: null,
        summary: null,
      }
    }
    case 'tool_result':
      return toolResult(id, raw, reject)
    case 'image':
    case 'document':
      return mediaContent(input, reject)
    default:
      reject(`message-block:${block.data.type}`)
      return null
  }
}

export function decodeClaudeBlocks(
  input: { id: string; role: Role; message: unknown; vendorEnvelope: boolean },
  reject: RejectClaudeShape,
): FeedContent[] {
  const parsed = messageSchema.safeParse(input.message)
  if (!parsed.success || parsed.data.role !== input.role) {
    reject('message')
    return []
  }
  const blocks =
    typeof parsed.data.content === 'string'
      ? [{ type: 'text', text: parsed.data.content }]
      : parsed.data.content
  const content: FeedContent[] = []
  blocks.forEach((raw, index) => {
    const id = blocks.length === 1 ? input.id : `${input.id}:${index}`
    const candidate = decodeBlock(
      { id, role: input.role, raw, vendorEnvelope: input.vendorEnvelope },
      reject,
    )
    if (candidate === null) return
    content.push(candidate)
  })
  return content
}
