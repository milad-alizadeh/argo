import { isRecord } from '@/shared/validation'
import { dataImageUrl, imageBlocks } from '../../../domains/sessions/contract/feed-images'
import type {
  ContentBlock,
  RichResultBlock,
  ToolCall,
  ToolResult,
} from '../../../domains/sessions/contract/transcript'
import { bashFacts } from './bash-facts'
import { editFacts } from './edit-facts'
import { lookupFacts } from './lookup-facts'
import { POLL_TOOLS, skillOrOtherFacts } from './other-facts'

// The receipt's own sentence: "Output is being written to: <path>. You will be notified ...".
const OUTPUT_FILE = /Output is being written to: (\S+?)\.?(?:\s|$)/

const INTERRUPTED = /^\[Request interrupted by user( for tool use)?\]$/

// A pasted image is inline bytes; any other image source keeps the generic source fallback.
function readImage(value: unknown): ContentBlock | null {
  if (!isRecord(value) || value.type !== 'image' || !isRecord(value.source)) return null
  const { type, media_type: mediaType, data } = value.source
  if (type !== 'base64' || typeof mediaType !== 'string' || typeof data !== 'string') return null
  return imageBlocks([dataImageUrl(mediaType, data)])[0] ?? null
}

// A `tool_use` block that draws: a poll or wait call names a task the Feed already drew, so it is
// neither a row nor a block.
function visibleToolUse(value: unknown): { id: string; name: string } | null {
  if (!isRecord(value) || value.type !== 'tool_use') return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return POLL_TOOLS.has(value.name) ? null : { id: value.id, name: value.name }
}

function readBlock(value: unknown): ContentBlock | null {
  const tool = visibleToolUse(value)
  if (tool !== null) return { shape: 'tool', callId: tool.id }
  if (isRecord(value) && value.type === 'tool_use') return null
  if (isRecord(value) && value.type === 'tool_result') return null
  if (isRecord(value) && value.type === 'text' && typeof value.text === 'string') {
    return INTERRUPTED.test(value.text)
      ? { shape: 'marker', marker: 'interrupted' }
      : { shape: 'prose', text: value.text }
  }
  if (isRecord(value) && value.type === 'thinking' && typeof value.thinking === 'string') {
    return { shape: 'thought', text: value.thinking }
  }
  const image = readImage(value)
  if (image !== null) return image
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

function readToolCall(id: string, name: string, input: Record<string, unknown>): ToolCall {
  const execute = name === 'Bash' ? bashFacts(input) : undefined
  return {
    id,
    name,
    input,
    ...(execute === undefined ? {} : { execute }),
    ...lookupFacts(name, input),
    ...skillOrOtherFacts(name, input),
    ...editFacts(name, input),
  }
}

export function readToolCalls(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) => {
    const tool = visibleToolUse(block)
    if (tool === null) return []
    const input = isRecord(block) && isRecord(block.input) ? block.input : {}
    return [readToolCall(tool.id, tool.name, input)]
  })
}

// The call went to the background, so `result` is a receipt rather than the command's output.
// The task id is a field of the record's own `toolUseResult`: `backgroundTaskId` for a Shell,
// `agentId` for an async Subagent. The output file is only ever stated in the receipt's
// sentence, so it is read from there and absent when it is not.
function backgroundTaskId(result: Record<string, unknown>): string | null {
  if (typeof result.backgroundTaskId === 'string') return result.backgroundTaskId
  if (result.isAsync === true && typeof result.agentId === 'string') return result.agentId
  return null
}

function readBackground(
  result: unknown,
  content: string | null,
): ToolResult['background'] | undefined {
  const taskId = isRecord(result) ? backgroundTaskId(result) : null
  if (taskId === null) return undefined
  return {
    taskId,
    outputPath: (content === null ? null : OUTPUT_FILE.exec(content)?.[1]) ?? null,
  }
}

export function readToolResults(content: unknown, result?: unknown): ToolResult[] {
  if (!Array.isArray(content)) return []
  return content.flatMap((block: unknown) => {
    if (!isRecord(block) || block.type !== 'tool_result') return []
    if (typeof block.tool_use_id !== 'string') return []
    const blocks = readResultBlocks(block.content)
    const text = blocks.flatMap((item) => (item.shape === 'text' ? [item.text] : [])).join('\n')
    const background = readBackground(result, text || null)
    return [
      {
        callId: block.tool_use_id,
        blocks,
        failed: block.is_error === true,
        ...(background === undefined ? {} : { background }),
      },
    ]
  })
}

function readResultBlocks(content: unknown): RichResultBlock[] {
  if (typeof content === 'string') return [{ shape: 'text', text: content }]
  if (!Array.isArray(content)) return []
  return content.flatMap((block): RichResultBlock[] => {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string')
      return [{ shape: 'text', text: block.text }]
    const image = readImage(block)
    return image?.shape === 'image' ? [{ shape: 'image', url: image.url }] : []
  })
}
