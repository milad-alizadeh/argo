import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent, MediaSource } from '@/domains/sessions/api/feed-content'
import { decodeClaudeText, type RejectClaudeShape } from './claude-feed-envelopes'

type AssistantBlock = Extract<SDKMessage, { type: 'assistant' }>['message']['content'][number]
type TextBlock = Extract<AssistantBlock, { type: 'text' }>
type ToolUseBlock = Extract<AssistantBlock, { type: 'tool_use' }>
type UserContent = Extract<SDKMessage, { type: 'user' }>['message']['content']
type UserBlock = NonNullable<Exclude<UserContent, string>>[number]
type ToolResultBlock = Extract<UserBlock, { type: 'tool_result' }>
type ToolResultPart = NonNullable<Exclude<ToolResultBlock['content'], string>>[number]
type MediaBlock = Extract<AssistantBlock | UserBlock, { type: 'image' | 'document' }>
export type ClaudeMessage = Extract<SDKMessage, { type: 'user' | 'assistant' }>['message']

type Role = Extract<SDKMessage, { type: 'user' | 'assistant' }>['type']
type ToolPart = NonNullable<Extract<FeedContent, { kind: 'tool' }>['output']>[number]
type ToolPresentation = NonNullable<Extract<FeedContent, { kind: 'tool' }>['presentation']>

function toolPresentation(name: string, input: unknown): ToolPresentation {
  const fields =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  const word = (key: string) => (typeof fields[key] === 'string' ? fields[key] : null)
  const description = word('description')
  const present = (kind: ToolPresentation['kind'], label: string): ToolPresentation => ({
    kind,
    label: description ?? label,
    ...(description === null ? {} : { agentDescription: true }),
  })
  switch (name) {
    case 'Bash': {
      const command = word('command')?.split('\n')[0] ?? null
      return present('command', `Ran ${command ?? 'command'}`)
    }
    case 'Read':
      return present('read', `Read ${word('file_path') ?? 'file'}`)
    case 'Edit':
      return present('edited', `Edited ${word('file_path') ?? 'file'}`)
    case 'Write':
      return present('created', `Created ${word('file_path') ?? 'file'}`)
    case 'Grep':
    case 'Glob':
    case 'WebSearch':
      return present('searched', `Searched ${word('pattern') ?? word('query') ?? ''}`.trim())
    case 'WebFetch':
      return present('read', `Read ${word('url') ?? 'page'}`)
    case 'Skill':
      return present('skill', word('skill') ?? 'Skill')
    default:
      return present('tool', name)
  }
}

function mediaSource(source: MediaBlock['source']): MediaSource | null {
  if (source.type === 'url') return { kind: 'url', url: source.url }
  if (source.type === 'base64')
    return { kind: 'data', mimeType: source.media_type, base64: source.data }
  return null
}

function toolPart(part: ToolResultPart, reject: RejectClaudeShape): ToolPart | null {
  if (part.type === 'text') return { kind: 'text', text: part.text }
  if (part.type === 'image') {
    const source = mediaSource(part.source)
    if (source !== null) return { kind: 'image', source }
  }
  reject('tool-result-part')
  return null
}

function toolResult(id: string, result: ToolResultBlock, reject: RejectClaudeShape): FeedContent {
  const output: ToolPart[] = []
  if (typeof result.content === 'string') output.push({ kind: 'text', text: result.content })
  else
    for (const part of result.content ?? []) {
      const decoded = toolPart(part, reject)
      if (decoded !== null) output.push(decoded)
    }
  return {
    id,
    kind: 'tool',
    callId: result.tool_use_id,
    name: '',
    status: result.is_error ? 'failed' : 'completed',
    input: null,
    output,
    summary: null,
  }
}

function mediaContent(
  input: { id: string; role: Role; raw: MediaBlock },
  reject: RejectClaudeShape,
): FeedContent | null {
  const source = mediaSource(input.raw.source)
  if (source === null && input.raw.source.type !== 'text') {
    reject('media-source')
    return null
  }
  if (input.raw.source.type === 'text') {
    if (input.raw.type !== 'document') {
      reject('document-text-source')
      return null
    }
    return {
      id: input.id,
      kind: 'reference',
      referenceType: 'pasted',
      label: 'Document text',
      target: null,
      text: input.raw.source.data,
    }
  }
  if (source === null) return null
  return { id: input.id, kind: 'media', mediaType: input.raw.type, source, role: input.role }
}

function decodeBlock(
  input: {
    id: string
    role: Role
    raw: AssistantBlock | UserBlock
    vendorEnvelope: boolean
    humanInput: boolean
  },
  reject: RejectClaudeShape,
): FeedContent | null {
  const { id, role, raw, vendorEnvelope } = input
  switch (raw.type) {
    case 'text': {
      const text = raw as TextBlock
      return text.text.trim() === ''
        ? null
        : decodeClaudeText(
            { id, role, text: text.text, vendorEnvelope, humanInput: input.humanInput },
            reject,
          )
    }
    case 'thinking':
      return { id, kind: 'reasoning', text: raw.thinking, redacted: false }
    case 'redacted_thinking':
      return { id, kind: 'reasoning', text: null, redacted: true }
    case 'tool_use': {
      const tool = raw as ToolUseBlock
      return {
        id,
        kind: 'tool',
        callId: tool.id,
        name: tool.name,
        status: 'running',
        input: tool.input as Extract<FeedContent, { kind: 'tool' }>['input'],
        output: null,
        summary: null,
        presentation: toolPresentation(tool.name, tool.input),
      }
    }
    case 'tool_result':
      return toolResult(id, raw as ToolResultBlock, reject)
    case 'image':
    case 'document':
      return mediaContent({ ...input, raw: raw as MediaBlock }, reject)
    default:
      reject(`message-block:${raw.type}`)
      return null
  }
}

export function decodeClaudeBlocks(
  input: {
    id: string
    role: Role
    message: ClaudeMessage
    vendorEnvelope: boolean
    humanInput?: boolean
  },
  reject: RejectClaudeShape,
): FeedContent[] {
  const blocks =
    typeof input.message.content === 'string'
      ? [{ type: 'text', text: input.message.content } as TextBlock]
      : input.message.content
  const content: FeedContent[] = []
  blocks.forEach((raw, index) => {
    const id = blocks.length === 1 ? input.id : `${input.id}:${index}`
    const candidate = decodeBlock(
      {
        id,
        role: input.role,
        raw,
        vendorEnvelope: input.vendorEnvelope,
        humanInput: input.humanInput ?? false,
      },
      reject,
    )
    if (candidate === null) return
    content.push(candidate)
  })
  return content
}
