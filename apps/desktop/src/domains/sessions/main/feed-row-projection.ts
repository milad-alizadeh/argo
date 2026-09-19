import type { SessionFeedRow } from '@/domains/sessions/contract/models'
import { type ToolEvidence, toolRows } from '@/domains/sessions/contract/tool-feed'
import type {
  ContentBlock,
  SubagentEvent,
  ToolCall,
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/transcript'
import { withPromptAttachments } from '@/domains/sessions/main/prompt-attachments'

function resultImageRows(record: TranscriptMessage): SessionFeedRow[] {
  return (record.toolResults ?? []).flatMap((result, resultIndex) =>
    result.blocks.flatMap((block, blockIndex): SessionFeedRow[] =>
      block.shape === 'image'
        ? [
            {
              shape: 'image',
              id: `${record.uuid}:result:${resultIndex}:${blockIndex}`,
              role: record.role,
              source: block.url,
            },
          ]
        : [],
    ),
  )
}

function subagentRow(record: SubagentEvent): SessionFeedRow {
  return {
    shape: 'subagent',
    id: record.uuid,
    subagentId: record.subagentId,
    event: record.event,
    ...(record.event === 'responded' ? { state: record.state } : {}),
    ...(record.name === undefined ? {} : { name: record.name }),
    ...(record.type === undefined ? {} : { type: record.type }),
    ...(record.model === undefined ? {} : { model: record.model }),
    ...(record.durationMs === undefined ? {} : { durationMs: record.durationMs }),
    ...(record.tokens === undefined ? {} : { tokens: record.tokens }),
    ...(record.text === undefined ? {} : { text: record.text }),
  }
}

export function rowsOfRecord(
  record: TranscriptRecord,
  position: string,
  evidence: ToolEvidence,
): SessionFeedRow[] {
  if (record.kind === 'unreadable') return [{ shape: 'unreadable', id: `unreadable:${position}` }]
  if (record.kind === 'compaction')
    return [
      {
        shape: 'marker',
        id: `${record.uuid}:compacted`,
        marker: 'compacted',
        summary: record.summary ?? null,
      },
    ]
  if (record.kind === 'turn')
    return record.state === 'aborted'
      ? [
          {
            shape: 'marker',
            id: `${record.uuid}:interrupted`,
            marker: 'interrupted',
            summary: null,
          },
        ]
      : []
  if (record.kind === 'command-output')
    return [{ shape: 'command-output', id: record.uuid, text: record.text }]
  if (record.kind === 'event')
    return [{ shape: 'event', id: record.uuid, event: record.event, text: record.text, raw: null }]
  if (record.kind === 'subagent') return [subagentRow(record)]
  // A subagent's turn is not this Session's history. The CLI nests it; Argo leaves it out rather
  // than drawing another agent's work as the reader's own (see `chainMessages`).
  if (record.kind !== 'message' || record.sidechain) return []
  const calls = new Map(record.toolCalls.map((call) => [call.id, call] as const))
  const blocks = mergedThoughtBlocks(record.blocks)
  const rows = blocks.flatMap((block, index) =>
    rowsOfBlock({ block, id: `${record.uuid}:${index}`, record, calls, evidence }),
  )
  return [...withPromptAttachments(rows, record), ...resultImageRows(record)]
}

// Codex packs a whole reasoning item's several summary chunks into one record's blocks. Folding a
// run of them down to the latest keeps the Feed to one updating thought per turn instead of a
// trail of bold lines, one per chunk (#2410).
function mergedThoughtBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const merged: ContentBlock[] = []
  for (const block of blocks) {
    if (block.shape === 'thought' && merged.at(-1)?.shape === 'thought')
      merged[merged.length - 1] = block
    else merged.push(block)
  }
  return merged
}

function rowsOfBlock({
  block,
  id,
  record,
  calls,
  evidence,
}: {
  block: ContentBlock
  id: string
  record: TranscriptMessage
  calls: Map<string, ToolCall>
  evidence: ToolEvidence
}): SessionFeedRow[] {
  switch (block.shape) {
    case 'prose':
      return [{ shape: 'prose', id, role: record.role, text: block.text }]
    // An empty thinking block (redacted or summarized away by the API) draws nothing, so it must
    // not count as a delivery either, or it silently splits a tool run across it (#2100).
    case 'thought':
      return block.text.trim() === '' ? [] : [{ shape: 'thought', id, text: block.text }]
    case 'marker':
      return [{ shape: 'marker', id, marker: block.marker, summary: null }]
    case 'event':
      return [{ shape: 'event', id, event: block.event, text: block.text, raw: block.raw ?? null }]
    case 'tool': {
      const call = calls.get(block.callId)
      return call === undefined ? [] : toolRows([call], evidence)
    }
    // A prompt's attachments are drawn in its bubble by `withPromptAttachments`.
    case 'file':
      return []
    case 'image':
      return record.role === 'user'
        ? []
        : [{ shape: 'image', id, role: record.role, source: block.url }]
    case 'source':
      return [{ shape: 'source', id, role: record.role, label: block.label, source: block.source }]
  }
}

// Tool results, and an assistant message left with nothing to show (an empty or redacted
// thinking block), are deliberately silent in the Feed: they carry no delivery of their own, so
// a Tool run spanning them merges. A sidechain message is a subagent's own turn (see
// `rowsOfRecord`, which already drops its rows), a real delivery this Session never made, so a
// Tool run must not read across it.
export function isHiddenToolRunBoundary(record: TranscriptRecord, rows: SessionFeedRow[]) {
  return (
    rows.length === 0 &&
    ((record.kind === 'message' && record.sidechain) ||
      (record.kind === 'trace' && record.boundary === true))
  )
}
