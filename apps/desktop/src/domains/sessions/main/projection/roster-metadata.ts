import type {
  ContentBlock,
  EditFacts,
  ToolCall,
  TranscriptRecord,
} from '@/domains/sessions/contract/model'

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

// The Roster names the files an edit touched; the diffs are Feed content.
function withoutDiffs(edit: EditFacts): EditFacts {
  return { ...edit, files: edit.files.map((file) => ({ ...file, diff: '' })) }
}

// The newest headline thought is the Roster's activity while it stands, so its one line survives.
function headlineThought(blocks: ContentBlock[]): ContentBlock[] {
  const thought = blocks.findLast((block) => block.shape === 'thought')
  return thought === undefined ? [] : [{ shape: 'thought', text: thought.text.trim() }]
}

function rosterCall(call: ToolCall): ToolCall {
  switch (call.kind) {
    case 'edit':
      return { ...call, files: withoutDiffs(call).files }
    case 'execute':
      return { ...call, text: null }
    default:
      return call
  }
}

// The Roster needs Session facts, not Feed content. Keeping only the fields its projections read
// prevents every background poll from retaining the full prose and tool payloads of recent files.
export function rosterMetadata(record: TranscriptRecord): TranscriptRecord {
  if (record.kind === 'unreadable') return { ...record, line: '' }
  if (record.kind !== 'message') return record
  return {
    ...record,
    blocks: record.role === 'user' ? openingLine(record.blocks) : headlineThought(record.blocks),
    toolCalls: record.toolCalls.map(rosterCall),
    toolResults: record.toolResults?.map((result) => ({ ...result, blocks: [] })),
  }
}
