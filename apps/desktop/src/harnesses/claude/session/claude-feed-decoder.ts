import type { SDKMessage, SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { type ClaudeMessage, decodeClaudeBlocks } from './claude-feed-blocks'
import type { RejectClaudeShape } from './claude-feed-envelopes'
import { decodeClaudeSystemContent } from './claude-feed-system'

function assistantContentId(message: unknown, fallback: string): string {
  return message !== null &&
    typeof message === 'object' &&
    'id' in message &&
    typeof message.id === 'string' &&
    message.id !== ''
    ? message.id
    : fallback
}

export function decodeClaudeHistoryContent(
  message: SessionMessage,
  reject: RejectClaudeShape,
): FeedContent[] {
  if (message.type === 'system') return []
  if (message.type === 'user' && 'isCompactSummary' in message && message.isCompactSummary === true)
    return [{ id: message.uuid, kind: 'marker', marker: 'compaction', summary: null }]
  const origin = 'origin' in message ? message.origin : undefined
  const humanInput =
    origin !== undefined &&
    origin !== null &&
    typeof origin === 'object' &&
    'kind' in origin &&
    origin.kind === 'human'
  try {
    return decodeClaudeBlocks(
      {
        id:
          message.type === 'assistant'
            ? assistantContentId(message.message, message.uuid)
            : message.uuid,
        role: message.type,
        message: message.message as ClaudeMessage,
        vendorEnvelope: origin !== undefined && !humanInput,
        humanInput,
      },
      reject,
    )
  } catch {
    reject('history-content')
    return []
  }
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
  try {
    return decodeLiveMessage(
      message,
      message.uuid ?? message.session_id ?? crypto.randomUUID(),
      reject,
    )
  } catch {
    reject(`malformed-live-content:${message.type}`)
    return []
  }
}
