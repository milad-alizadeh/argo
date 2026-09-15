import type { ContentBlock, TranscriptRecord } from './transcript'

function openingLine(blocks: ContentBlock[]): ContentBlock[] {
  for (const block of blocks) {
    if (block.shape !== 'prose') continue
    const line = block.text.split('\n').find((text) => text.trim().length > 0)
    if (line !== undefined) return [{ shape: 'prose', text: line }]
  }
  return []
}

function rosterToolInput(input: Record<string, unknown>): Record<string, unknown> {
  const fields = [
    'command',
    'description',
    'file_path',
    'notebook_path',
    'path',
    'pattern',
    'query',
    'run_in_background',
    'url',
  ]
  const kept = Object.fromEntries(
    fields.flatMap((field) => (field in input ? [[field, input[field]]] : [])),
  )
  const todos = input.todos
  if (!Array.isArray(todos)) return kept
  return {
    ...kept,
    todos: todos.flatMap((todo) => {
      if (typeof todo !== 'object' || todo === null) return []
      const { content, status } = todo as { content?: unknown; status?: unknown }
      return typeof content === 'string' && typeof status === 'string' ? [{ content, status }] : []
    }),
  }
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
      .map((result) => ({ ...result, content: null })),
  }
}
