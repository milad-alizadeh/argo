import { readHarnessEnvelopes } from '@/agents/codex/sessions/harness-envelopes'
import { readImage } from '@/agents/codex/sessions/prompt-images'
import type {
  ContentBlock,
  ToolCall,
  ToolResult,
  TranscriptRecord,
} from '@/domains/sessions/contract/transcript'
import { isRecord } from '@/shared/validation'

export function messageBlocks(
  value: unknown,
  proseTypes: readonly string[],
): ContentBlock[] | null {
  if (!Array.isArray(value)) return null
  return value.map((block): ContentBlock => {
    const image = isRecord(block) ? readImage(block) : null
    if (image !== null) return image
    if (
      isRecord(block) &&
      typeof block.type === 'string' &&
      proseTypes.includes(block.type) &&
      typeof block.text === 'string'
    ) {
      return { shape: 'prose', text: block.text }
    }
    const label = isRecord(block) && typeof block.type === 'string' ? block.type : 'unfamiliar'
    return { shape: 'source', label, source: JSON.stringify(block, null, 2) ?? String(block) }
  })
}

export function messageRecord(
  record: Record<string, unknown>,
  message: {
    uuid: string
    role: 'user' | 'assistant'
    originSessionId: string | null
    blocks: ContentBlock[]
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
  },
): TranscriptRecord {
  const toolResults = message.toolResults ?? []
  return readHarnessEnvelopes({
    kind: 'message',
    uuid: message.uuid,
    parentUuid: null,
    originSessionId: message.originSessionId,
    role: message.role,
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: typeof record.timestamp === 'string' ? record.timestamp : null,
    entry: 'interactive',
    stopReason: null,
    model: null,
    effort: null,
    mode: null,
    blocks: message.blocks,
    toolCalls: message.toolCalls ?? [],
    toolResults,
    answeredCalls: toolResults.map((result) => result.callId),
    usage: null,
  })
}
