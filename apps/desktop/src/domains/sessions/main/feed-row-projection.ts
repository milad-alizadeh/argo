import type { SessionFeedRow } from '@/domains/sessions/contract/models'
import { type ToolEvidence, toolRows } from '@/domains/sessions/contract/tool-feed'
import type {
  ContentBlock,
  ToolCall,
  TranscriptMessage,
  TranscriptRecord,
} from '@/domains/sessions/contract/transcript'
import { withPromptAttachments } from './prompt-attachments'

function resultImageRows(record: TranscriptMessage): SessionFeedRow[] {
  return (record.toolResults ?? []).flatMap((result, resultIndex) =>
    result.blocks.flatMap((block, blockIndex): SessionFeedRow[] =>
      block.shape === 'image'
        ? [
            {
              shape: 'source',
              id: `${record.uuid}:result:${resultIndex}:${blockIndex}`,
              role: record.role,
              label: 'image',
              source: block.url,
            },
          ]
        : [],
    ),
  )
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
  if (record.kind === 'delegation')
    return [
      {
        shape: 'delegation',
        id: record.uuid,
        actor: record.actor,
        action: record.action,
        status: record.status,
        progress: record.progress,
        groupId: record.groupId,
        callId: record.callId,
      },
    ]
  if (record.kind !== 'message' || record.sidechain) return []
  const calls = new Map(record.toolCalls.map((call) => [call.id, call] as const))
  const rows = mergedThoughtBlocks(record.blocks).flatMap((block, index) =>
    rowsOfBlock({ block, id: `${record.uuid}:${index}`, record, calls, evidence }),
  )
  return [...withPromptAttachments(rows, record), ...resultImageRows(record)]
}

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
    case 'file':
      return []
    case 'image':
      return record.role === 'user'
        ? []
        : [{ shape: 'source', id, role: record.role, label: 'image', source: block.url }]
    case 'source':
      return [{ shape: 'source', id, role: record.role, label: block.label, source: block.source }]
  }
}

export function isHiddenToolRunBoundary(record: TranscriptRecord, rows: SessionFeedRow[]) {
  return (
    rows.length === 0 &&
    ((record.kind === 'message' && record.sidechain) ||
      (record.kind === 'trace' && record.boundary === true))
  )
}
