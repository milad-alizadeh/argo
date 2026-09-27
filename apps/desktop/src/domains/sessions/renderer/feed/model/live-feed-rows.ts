import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { SessionFeedRow } from '../../types'

function workStatus(
  status: Extract<FeedContent, { kind: 'tool' }>['status'],
): Extract<SessionFeedRow, { shape: 'tool' }>['status'] {
  switch (status) {
    case 'pending':
    case 'running':
    case 'paused':
      return 'running'
    case 'completed':
      return 'succeeded'
    case 'failed':
      return 'failed'
    case 'interrupted':
      return 'interrupted'
  }
}

function textOutput(content: Extract<FeedContent, { kind: 'tool' }>): string | null {
  const text = content.output?.flatMap((part) => (part.kind === 'text' ? [part.text] : [])) ?? []
  return text.length === 0 ? null : text.join('\n')
}

function toolContentRow(content: Extract<FeedContent, { kind: 'tool' }>): SessionFeedRow {
  const source = textOutput(content)
  return {
    shape: 'tool',
    id: content.callId,
    kind: 'tool',
    label: content.name || content.summary || content.callId,
    lineCounts: null,
    status: workStatus(content.status),
    evidence:
      source === null ? null : { kind: 'output', title: content.name || content.callId, source },
    text: null,
  }
}

function commandContentRow(content: Extract<FeedContent, { kind: 'command' }>): SessionFeedRow {
  return {
    shape: 'tool',
    id: content.id,
    kind: 'command',
    label: content.command ?? content.id,
    lineCounts: null,
    status: workStatus(content.status),
    evidence:
      content.output === null
        ? null
        : { kind: 'output', title: content.command ?? content.id, source: content.output },
    text: content.command,
  }
}

function contentRow(content: FeedContent): SessionFeedRow | null {
  switch (content.kind) {
    case 'message':
      return content.role === 'system'
        ? null
        : { shape: 'prose', id: content.id, role: content.role, text: content.text }
    case 'reasoning':
      return content.text === null ? null : { shape: 'thought', id: content.id, text: content.text }
    case 'tool':
      return toolContentRow(content)
    case 'command':
      return commandContentRow(content)
    case 'notification':
      return { shape: 'event', id: content.id, event: 'status', text: content.text }
    case 'context':
      return { shape: 'event', id: content.id, event: 'context', text: content.text }
    case 'marker':
      return content.marker === 'compaction' || content.marker === 'interrupted'
        ? {
            shape: 'marker',
            id: content.id,
            marker: content.marker === 'compaction' ? 'compacted' : 'interrupted',
            summary: content.summary,
          }
        : { shape: 'event', id: content.id, event: 'status', text: content.summary }
    default:
      return null
  }
}

function liveRow(event: SessionLiveEvent): SessionFeedRow | null {
  switch (event.type) {
    case 'content':
      return contentRow(event.content)
    case 'status':
      return {
        shape: 'event',
        id: `status:${event.turnId ?? event.commandId ?? event.sequence}:${event.status}`,
        event: 'status',
        text: event.status,
      }
    case 'permission':
      return {
        shape: 'event',
        id: event.requestId,
        event: 'status',
        text: `Permission: ${event.description}`,
      }
    case 'question':
      return {
        shape: 'ask',
        id: event.requestId,
        questions: event.questions,
        answer: event.answer,
        unsupported: null,
      }
    case 'failure':
      return {
        shape: 'event',
        id: `failure:${event.turnId ?? event.sequence}`,
        event: 'status',
        text: event.detail,
      }
  }
}

function rowKey(row: SessionFeedRow): string {
  const id = row.shape === 'prose' || row.shape === 'thought' ? row.id.replace(/:0$/, '') : row.id
  return `${row.shape}:${id}`
}

export function projectLiveFeedRows(
  history: readonly FeedContent[],
  live: readonly SessionLiveEvent[],
): SessionFeedRow[] {
  const rows: SessionFeedRow[] = []
  const index = new Map<string, number>()
  const settled = new Set<string>()
  for (const content of history) {
    const row = contentRow(content)
    if (row === null) continue
    const key = rowKey(row)
    const prior = index.get(key)
    if (prior === undefined) {
      index.set(key, rows.length)
      rows.push(row)
    } else rows[prior] = row
    settled.add(key)
  }
  for (const event of [...live].sort((left, right) => left.sequence - right.sequence)) {
    const row = liveRow(event)
    if (row === null) continue
    const key = rowKey(row)
    if (settled.has(key)) continue
    const prior = index.get(key)
    if (prior === undefined) {
      index.set(key, rows.length)
      rows.push(row)
    } else rows[prior] = row
  }
  return rows
}
