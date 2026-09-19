import type { ContentBlock, EditFacts, TranscriptRecord } from '../contract/transcript'

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

// The Roster names the files an edit touched; the diffs are Feed content.
function withoutDiffs(edit: EditFacts): EditFacts {
  return { ...edit, files: edit.files.map((file) => ({ ...file, diff: '' })) }
}

// The newest headline thought is the Roster's activity while it stands, so its one line survives.
function headlineThought(blocks: ContentBlock[]): ContentBlock[] {
  const thought = blocks.findLast((block) => block.shape === 'thought')
  return thought === undefined ? [] : [{ shape: 'thought', text: thought.text.trim() }]
}

// The Roster needs Session facts, not Feed content. Keeping only the fields its projections read
// prevents every background poll from retaining the full prose and tool payloads of recent files.
export function rosterMetadata(record: TranscriptRecord): TranscriptRecord {
  if (record.kind === 'unreadable') return { ...record, line: '' }
  if (record.kind !== 'message') return record
  return {
    ...record,
    blocks: record.role === 'user' ? openingLine(record.blocks) : headlineThought(record.blocks),
    toolCalls: record.toolCalls.map((call) => ({
      ...call,
      input: rosterToolInput(call.input),
      ...(call.edit === undefined ? {} : { edit: withoutDiffs(call.edit) }),
    })),
    toolResults: record.toolResults
      ?.filter((result) => result.background !== undefined)
      .map((result) => ({ ...result, blocks: [] })),
  }
}
