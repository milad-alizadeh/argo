import { dataImageUrl } from '@/domains/sessions/contract/model'
import {
  type RichResultBlock,
  resultText,
  type ToolResult,
} from '@/domains/sessions/contract/model'
import { isRecord } from '@/shared/validation'
import { readImage } from './prompt-images'

function resultBlocks(output: unknown): RichResultBlock[] {
  if (typeof output === 'string') return [{ shape: 'text', text: output }]
  if (!Array.isArray(output)) return []
  return output.flatMap((block): RichResultBlock[] => {
    if (isRecord(block) && typeof block.text === 'string')
      return [{ shape: 'text', text: block.text }]
    if (
      isRecord(block) &&
      block.type === 'image' &&
      typeof block.data === 'string' &&
      typeof block.mimeType === 'string'
    ) {
      const url = dataImageUrl(block.mimeType, block.data)
      return url === null ? [] : [{ shape: 'image', url }]
    }
    const image = isRecord(block) ? readImage(block) : null
    return image?.shape === 'image' ? [{ shape: 'image', url: image.url }] : []
  })
}

const EXIT_CODE = /^Process exited with code (\d+)$/m

function failedText(content: string | null): boolean {
  if (content === null) return false
  const match = content.match(EXIT_CODE)
  return match !== null && match[1] !== '0'
}

function typedCompletion(value: unknown): { blocks: RichResultBlock[]; failed: boolean } | null {
  if (!isRecord(value)) return null
  const explicitFailure = value.isError === true
  const exitFailure = Number.isInteger(value.exit_code) && value.exit_code !== 0
  if (!('isError' in value) && !('exit_code' in value)) return null
  const content = Array.isArray(value.content) ? value.content : value.output
  return { blocks: resultBlocks(content), failed: explicitFailure || exitFailure }
}

function typedItem(item: unknown) {
  if (!isRecord(item) || typeof item.text !== 'string') return null
  try {
    return typedCompletion(JSON.parse(item.text))
  } catch {
    return null
  }
}

function completionItems(output: unknown): unknown[] {
  if (!Array.isArray(output)) return [output]
  return output.filter(
    (block) =>
      !(
        isRecord(block) &&
        block.type === 'input_text' &&
        typeof block.text === 'string' &&
        block.text.startsWith('Script ')
      ),
  )
}

function completionResult(item: unknown) {
  const typed = typedItem(item)
  if (typed !== null) return typed
  const blocks = resultBlocks([item])
  return { blocks, failed: failedText(resultText(blocks)) }
}

export function readToolResults(payload: Record<string, unknown>): ToolResult[] {
  if (typeof payload.call_id !== 'string') return []
  const completions = completionItems(payload.output)
  if (payload.type === 'custom_tool_call_output' && completions.length > 0)
    return completions.map((item, index) => ({
      callId: `${payload.call_id}:${index}`,
      ...completionResult(item),
    }))
  const blocks = resultBlocks(payload.output)
  const callId =
    payload.type === 'custom_tool_call_output' ? `${payload.call_id}:0` : payload.call_id
  return [{ callId, blocks, failed: failedText(resultText(blocks)) }]
}
