import type { ContentBlock, TranscriptRecord } from '../contract/transcript'

function openingLine(blocks: ContentBlock[]): ContentBlock[] {
  for (const block of blocks) {
    const acceptsOpeningPrompt =
      block.shape === 'prose' || (block.shape === 'event' && block.event === 'command')
    if (!acceptsOpeningPrompt || block.text === null) continue
    const line = block.text.split('\n').find((text) => text.trim().length > 0)
    if (line !== undefined) return [{ ...block, text: line }]
  }
  return []
}

function rosterToolInput(input: Record<string, unknown>): Record<string, unknown> {
  const fields = [
    'cmd',
    'command',
    'description',
    'file_path',
    'input',
    'notebook_path',
    'path',
    'pattern',
    'query',
    'run_in_background',
    'url',
  ]
  return Object.fromEntries(
    fields.flatMap((field) => (field in input ? [[field, input[field]]] : [])),
  )
}

// The Roster needs Session facts, not Feed content. Keeping only the fields its projections read
// prevents every background poll from retaining the full prose and tool payloads of recent files.
export function rosterMetadata(record: TranscriptRecord): TranscriptRecord {
  if (record.kind === 'unreadable') return { ...record, line: '' }
  if (record.kind !== 'message') return record
  return {
    ...record,
    blocks: record.role === 'user' ? openingLine(record.blocks) : [],
    toolCalls: record.toolCalls.map((call) => ({ ...call, input: rosterToolInput(call.input) })),
    toolResults: record.toolResults
      ?.filter((result) => result.background !== undefined)
      .map((result) => ({ ...result, blocks: [] })),
  }
}
