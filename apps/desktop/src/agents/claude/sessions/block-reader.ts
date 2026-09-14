import { isRecord } from '@/boundary'
import type { ContentBlock, ToolCall, ToolResult } from '@/core/sessions/transcript'

// The receipt's own sentence: "Output is being written to: <path>. You will be notified ...".
const OUTPUT_FILE = /Output is being written to: (\S+?)\.?(?:\s|$)/

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

// The call went to the background, so `result` is a receipt rather than the command's output.
// The task id is a field of the record's own `toolUseResult`; the output file is only ever
// stated in the receipt's sentence, so it is read from there and absent when it is not.
function readBackground(
  result: unknown,
  content: string | null,
): ToolResult['background'] | undefined {
  if (!isRecord(result) || typeof result.backgroundTaskId !== 'string') return undefined
  return {
    taskId: result.backgroundTaskId,
    outputPath: (content === null ? null : OUTPUT_FILE.exec(content)?.[1]) ?? null,
  }
}

export function readToolResults(content: unknown, result?: unknown): ToolResult[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) => {
    if (!isRecord(block) || block.type !== 'tool_result') return []
    if (typeof block.tool_use_id !== 'string') return []
    const text = typeof block.content === 'string' ? block.content : null
    const background = readBackground(result, text)
    return [
      {
        callId: block.tool_use_id,
        content: text,
        failed: block.is_error === true,
        ...(background === undefined ? {} : { background }),
      },
    ]
  })
}
