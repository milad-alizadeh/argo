import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { type FeedContent, feedContentSchema } from '@/domains/sessions/api/feed-content'
import { decodeClaudeBlocks } from './claude-feed-blocks'
import type { RejectClaudeShape } from './claude-feed-envelopes'
import { decodeClaudeSystemContent } from './claude-feed-system'

const liveEnvelopeSchema = z.object({
  type: z.string(),
  uuid: z.string().min(1),
  session_id: z.string().min(1),
})
const historyMessageEnvelopeSchema = z.object({
  type: z.enum(['user', 'assistant']),
  uuid: z.string().min(1),
  message: z.unknown(),
  origin: z.object({ kind: z.string() }).optional(),
})
const historySystemEnvelopeSchema = z.object({
  type: z.literal('system'),
  uuid: z.string().min(1),
  subtype: z.string().optional(),
})
const assistantIdentitySchema = z.object({ id: z.string().min(1) })

function assistantContentId(message: unknown, fallback: string): string {
  return assistantIdentitySchema.safeParse(message).data?.id ?? fallback
}

function validateContents(candidates: FeedContent[], reject: RejectClaudeShape): FeedContent[] {
  return candidates.flatMap((candidate) => {
    const parsed = feedContentSchema.safeParse(candidate)
    if (parsed.success) return [parsed.data]
    reject(`content:${candidate.kind}`)
    return []
  })
}

export function decodeClaudeHistoryContent(
  message: unknown,
  reject: RejectClaudeShape,
): FeedContent[] {
  const system = historySystemEnvelopeSchema.safeParse(message)
  if (system.success) {
    return system.data.subtype === 'compact_boundary'
      ? [{ id: system.data.uuid, kind: 'marker', marker: 'compaction', summary: null }]
      : []
  }
  const envelope = historyMessageEnvelopeSchema.safeParse(message)
  if (!envelope.success) {
    reject('history-envelope')
    return []
  }
  return validateContents(
    decodeClaudeBlocks(
      {
        id:
          envelope.data.type === 'assistant'
            ? assistantContentId(envelope.data.message, envelope.data.uuid)
            : envelope.data.uuid,
        role: envelope.data.type,
        message: envelope.data.message,
        vendorEnvelope: envelope.data.origin !== undefined && envelope.data.origin.kind !== 'human',
        humanInput: envelope.data.origin?.kind === 'human',
      },
      reject,
    ),
    reject,
  )
}

function decodeLiveActivity(message: SDKMessage, id: string): FeedContent[] | null {
  switch (message.type) {
    case 'tool_progress':
      return [
        {
          id,
          kind: 'tool',
          callId: message.tool_use_id,
          name: message.tool_name,
          status: 'running',
          input: null,
          output: null,
          summary: null,
        },
      ]
    case 'tool_use_summary':
      return message.preceding_tool_use_ids.map((callId, index) => ({
        id: `${id}:${index}`,
        kind: 'tool',
        callId,
        name: '',
        status: 'completed',
        input: null,
        output: null,
        summary: message.summary,
      }))
    case 'prompt_suggestion':
      return [
        {
          id,
          kind: 'notification',
          category: 'suggestion',
          text: message.suggestion,
          priority: null,
        },
      ]
    case 'conversation_reset':
      return [{ id, kind: 'marker', marker: 'conversationReset', summary: null }]
    default:
      return null
  }
}

function decodeLiveMessage(
  message: SDKMessage,
  id: string,
  reject: RejectClaudeShape,
): FeedContent[] {
  const activity = decodeLiveActivity(message, id)
  if (activity !== null) return activity
  switch (message.type) {
    case 'assistant':
      return decodeClaudeBlocks(
        {
          id: assistantContentId(message.message, id),
          role: 'assistant',
          message: message.message,
          vendorEnvelope: false,
        },
        reject,
      )
    case 'user':
      return decodeClaudeBlocks(
        {
          id,
          role: 'user',
          message: message.message,
          vendorEnvelope: message.origin !== undefined && message.origin.kind !== 'human',
          humanInput: message.origin?.kind === 'human',
        },
        reject,
      )
    case 'system':
      return decodeClaudeSystemContent(message, reject)
    case 'tool_progress':
    case 'tool_use_summary':
    case 'prompt_suggestion':
    case 'conversation_reset':
      return activity ?? []
    case 'stream_event':
    case 'result':
    case 'auth_status':
    case 'rate_limit_event':
      return []
    default:
      reject('live-type')
      return []
  }
}

export function decodeClaudeLiveContent(
  message: SDKMessage,
  reject: RejectClaudeShape,
): FeedContent[] {
  const envelope = liveEnvelopeSchema.safeParse(message)
  if (!envelope.success) {
    reject('live-envelope')
    return []
  }
  try {
    return validateContents(decodeLiveMessage(message, envelope.data.uuid, reject), reject)
  } catch {
    reject(`malformed-live-content:${envelope.data.type}`)
    return []
  }
}
