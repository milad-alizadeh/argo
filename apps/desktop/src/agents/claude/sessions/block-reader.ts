import { isRecord } from '@/boundary'
import type { ContentBlock, ToolCall, ToolResult } from '@/core/sessions/transcript'

const INTERRUPTED = /^\[Request interrupted by user( for tool use)?\]$/

function readBlock(value: unknown): ContentBlock | null {
  if (
    isRecord(value) &&
    value.type === 'tool_use' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  ) {
    return { shape: 'tool', callId: value.id }
  }
  if (isRecord(value) && value.type === 'tool_result') return null
  if (isRecord(value) && value.type === 'text' && typeof value.text === 'string') {
    return INTERRUPTED.test(value.text)
      ? { shape: 'marker', marker: 'interrupted' }
      : { shape: 'prose', text: value.text }
  }
  if (isRecord(value) && value.type === 'thinking' && typeof value.thinking === 'string') {
    return { shape: 'thought', text: value.thinking }
  }
  const label = isRecord(value) && typeof value.type === 'string' ? value.type : 'unfamiliar'
  return { shape: 'source', label, source: JSON.stringify(value, null, 2) ?? String(value) }
}

export function readBlocks(content: unknown): ContentBlock[] {
  if (typeof content === 'string') return [{ shape: 'prose', text: content }]
  if (!Array.isArray(content)) return []
  return content.flatMap((block) => {
    const read = readBlock(block)
    return read === null ? [] : [read]
  })
}

export function readToolCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) =>
    isRecord(block) &&
    block.type === 'tool_use' &&
    typeof block.id === 'string' &&
    typeof block.name === 'string'
      ? [{ id: block.id, name: block.name, input: isRecord(block.input) ? block.input : {} }]
      : [],
  )
}

export function readToolResults(content: unknown): ToolResult[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) =>
    isRecord(block) && block.type === 'tool_result' && typeof block.tool_use_id === 'string'
      ? [
          {
            callId: block.tool_use_id,
            content: typeof block.content === 'string' ? block.content : null,
            failed: block.is_error === true,
          },
        ]
      : [],
  )
}
