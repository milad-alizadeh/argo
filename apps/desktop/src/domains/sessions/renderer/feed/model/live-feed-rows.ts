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
    case 'media':
    case 'reference':
    case 'fileChange':
    case 'search':
    case 'plan':
    case 'delegation':
    case 'task':
    case 'refusal':
    case 'imageGeneration':
    case 'wait':
    case 'diagnostic':
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
        id: `status:${event.sequence}`,
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
        id: `failure:${event.sequence}`,
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
  const sortedLive = [...live].sort((left, right) => left.sequence - right.sequence)
  const questionCalls = new Set(
    sortedLive.flatMap((event) =>
      event.type === 'question' && event.vendorEventId !== null ? [event.vendorEventId] : [],
    ),
  )
  const settledThrough = sortedLive.reduce(
    (sequence, event) =>
      event.type === 'status' && event.status === 'idle'
        ? Math.max(sequence, event.sequence)
        : sequence,
    0,
  )
  const historyRows: SessionFeedRow[] = []
  const historyIndex = new Map<string, number>()
  for (const content of history) {
    if (content.kind === 'tool' && questionCalls.has(content.callId)) continue
    const row = contentRow(content)
    if (row === null) continue
    const key = rowKey(row)
    const prior = historyIndex.get(key)
    if (prior === undefined) {
      historyIndex.set(key, historyRows.length)
      historyRows.push(row)
    } else historyRows[prior] = row
  }
  const liveRows: { key: string; row: SessionFeedRow; sequence: number }[] = []
  const liveIndex = new Map<string, number>()
  for (const event of sortedLive) {
    if (event.type === 'content' && event.content.kind === 'tool')
      if (questionCalls.has(event.content.callId)) continue
    const row = liveRow(event)
    if (row === null) continue
    const key = rowKey(row)
    const prior = liveIndex.get(key)
    if (prior === undefined) {
      liveIndex.set(key, liveRows.length)
      liveRows.push({ key, row, sequence: event.sequence })
    } else liveRows[prior] = { key, row, sequence: event.sequence }
  }
  const firstMatch = liveRows
    .map(({ key }) => historyIndex.get(key))
    .find((position) => position !== undefined)
  const rows = historyRows.slice(0, firstMatch ?? historyRows.length)
  let nextHistory = firstMatch ?? historyRows.length
  for (const liveRow of liveRows) {
    const matched = historyIndex.get(liveRow.key)
    if (matched === undefined) {
      rows.push(liveRow.row)
      continue
    }
    if (matched < nextHistory) continue
    rows.push(...historyRows.slice(nextHistory, matched))
    rows.push(liveRow.sequence <= settledThrough ? (historyRows[matched] ?? liveRow.row) : liveRow.row)
    nextHistory = matched + 1
  }
  rows.push(...historyRows.slice(nextHistory))
  return rows
}
