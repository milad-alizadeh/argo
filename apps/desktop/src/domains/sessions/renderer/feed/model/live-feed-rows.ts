import type { FeedContent, MediaSource } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { SessionFeedRow } from '../../types'
import type { ToolCall } from '../source/tool-call'
import { checkedDataImageUrl, dataImageUrl, fileImageUrl } from './feed-images'
import { toolRows } from './tool-feed'

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

function presentedToolRow(
  call: ToolCall,
  status: Extract<FeedContent, { kind: 'tool' }>['status'],
  output: string[],
): SessionFeedRow {
  const results = new Map(
    output.length === 0 && status !== 'completed' && status !== 'failed'
      ? []
      : [
          [
            call.id,
            {
              blocks: output.map((text) => ({ shape: 'text' as const, text })),
              failed: status === 'failed',
            },
          ],
        ],
  )
  const row = toolRows([call], { results, skillBodies: new Map() })[0]
  if (row?.shape !== 'tool') throw new Error('A tool content item must draw one tool row.')
  return { ...row, status: workStatus(status) }
}

function toolContentRow(content: Extract<FeedContent, { kind: 'tool' }>): SessionFeedRow {
  const source = textOutput(content)
  const label = content.presentation?.label ?? content.summary ?? (content.name || content.callId)
  const call: ToolCall = {
    id: content.callId,
    kind: 'other',
    label,
    text: null,
    source: null,
    ...(content.presentation === undefined ? {} : { presentation: content.presentation }),
  }
  return presentedToolRow(call, content.status, source === null ? [] : [source])
}

function commandContentRow(content: Extract<FeedContent, { kind: 'command' }>): SessionFeedRow {
  const call: ToolCall = {
    id: content.id,
    kind: 'execute',
    command: content.command,
    label: null,
    text: content.command,
    background: false,
  }
  const output = [content.output, content.stderr].filter((part): part is string => part !== null)
  return presentedToolRow(call, content.status, output)
}

function mediaUrl(source: MediaSource): string | null {
  switch (source.kind) {
    case 'data':
      return dataImageUrl(source.mimeType, source.base64)
    case 'path':
      return fileImageUrl(source.path)
    case 'url':
      return checkedDataImageUrl(source.url)
  }
}

function toolOutputRows(content: Extract<FeedContent, { kind: 'tool' }>): SessionFeedRow[] {
  return (content.output ?? []).flatMap((part, index): SessionFeedRow[] => {
    const id = `${content.callId}:output:${index}`
    switch (part.kind) {
      case 'text':
        return []
      case 'image': {
        const source = mediaUrl(part.source)
        return source === null
          ? [{ shape: 'event', id, event: 'media', text: 'image' }]
          : [{ shape: 'image', id, role: 'assistant', source }]
      }
      case 'audio':
      case 'document':
        return [{ shape: 'event', id, event: 'media', text: part.kind }]
      case 'json':
        return [
          {
            shape: 'source',
            id,
            role: 'assistant',
            label: content.name,
            source: JSON.stringify(part.value),
          },
        ]
      case 'encrypted':
        return [{ shape: 'event', id, event: 'diagnostic', text: null }]
      default:
        return part satisfies never
    }
  })
}

function mergeToolContent(
  earlier: Extract<FeedContent, { kind: 'tool' }> | undefined,
  update: Extract<FeedContent, { kind: 'tool' }>,
): Extract<FeedContent, { kind: 'tool' }> {
  if (earlier === undefined) return update
  return {
    ...update,
    name: update.name || earlier.name,
    input: update.input ?? earlier.input,
    output: update.output ?? earlier.output,
    summary: update.summary ?? earlier.summary,
    presentation: update.presentation ?? earlier.presentation,
  }
}

function mergeProgressContent(
  earlier: Extract<FeedContent, { kind: 'task' | 'delegation' }> | undefined,
  update: Extract<FeedContent, { kind: 'task' | 'delegation' }>,
): Extract<FeedContent, { kind: 'task' | 'delegation' }> {
  if (earlier === undefined || earlier.kind !== update.kind) return update
  if (update.kind === 'task' && earlier.kind === 'task')
    return {
      ...update,
      status: update.status ?? earlier.status,
      description: update.description ?? earlier.description,
      summary: update.summary ?? earlier.summary,
    }
  if (update.kind === 'delegation' && earlier.kind === 'delegation')
    return {
      ...update,
      prompt: update.prompt ?? earlier.prompt,
      model: update.model ?? earlier.model,
      summary: update.summary ?? earlier.summary,
    }
  return update
}

function joinContent(
  content: FeedContent,
  tools: Map<string, Extract<FeedContent, { kind: 'tool' }>>,
  progress: Map<string, Extract<FeedContent, { kind: 'task' | 'delegation' }>>,
): FeedContent {
  switch (content.kind) {
    case 'tool': {
      const joined = mergeToolContent(tools.get(content.callId), content)
      tools.set(content.callId, joined)
      return joined
    }
    case 'task':
    case 'delegation': {
      const joined = mergeProgressContent(progress.get(content.id), content)
      progress.set(content.id, joined)
      return joined
    }
    default:
      return content
  }
}

function permissionEventKind(
  decision: Extract<SessionLiveEvent, { type: 'permission' }>['decision'],
): Extract<SessionFeedRow, { shape: 'event' }>['event'] {
  switch (decision) {
    case null:
      return 'permission'
    case 'allow':
    case 'allowForSession':
      return 'permissionGranted'
    case 'deny':
      return 'permissionDenied'
    case 'cancel':
      return 'permissionCancelled'
  }
}

function fileChangeRow(content: Extract<FeedContent, { kind: 'fileChange' }>): SessionFeedRow {
  const files = content.changes.map((change) => change.path)
  if (files.length === 0)
    return {
      shape: 'event',
      id: content.id,
      event: 'fileChange',
      text: null,
      status: content.status,
    }
  const lastChange = content.changes.at(-1)?.change
  let kind: Extract<SessionFeedRow, { shape: 'tool' }>['kind'] = 'edited'
  if (lastChange === 'add') kind = 'created'
  if (lastChange === 'delete') kind = 'deleted'
  const label = files.join(', ')
  return {
    shape: 'tool',
    id: content.id,
    kind,
    label,
    lineCounts: null,
    status: workStatus(content.status),
    evidence: {
      kind: 'diff',
      title: label,
      source: content.changes.map((change) => change.diff ?? '').join('\n'),
    },
    text: null,
  }
}

function markerRow(content: Extract<FeedContent, { kind: 'marker' }>): SessionFeedRow {
  if (content.marker === 'compaction' || content.marker === 'interrupted')
    return {
      shape: 'marker',
      id: content.id,
      marker: content.marker === 'compaction' ? 'compacted' : 'interrupted',
      summary: content.summary,
    }
  return { shape: 'event', id: content.id, event: 'status', text: content.summary }
}

function imageGenerationRow(
  content: Extract<FeedContent, { kind: 'imageGeneration' }>,
): SessionFeedRow {
  const source = content.source === null ? null : mediaUrl(content.source)
  if (source !== null) return { shape: 'image', id: content.id, role: 'assistant', source }
  return {
    shape: 'event',
    id: content.id,
    event: 'imageGeneration',
    text: content.failure ?? content.prompt,
    status: content.status,
  }
}

function otherContentRow(
  content: Exclude<
    FeedContent,
    { kind: 'message' | 'reasoning' | 'media' | 'reference' | 'tool' | 'command' | 'fileChange' }
  >,
): SessionFeedRow | null {
  switch (content.kind) {
    case 'search':
      return { shape: 'event', id: content.id, event: 'search', text: content.query }
    case 'plan':
      return { shape: 'event', id: content.id, event: 'plan', text: content.text }
    case 'delegation':
      return {
        shape: 'event',
        id: content.id,
        event: 'delegation',
        text: content.summary ?? content.prompt ?? content.agentId,
        status: content.status,
      }
    case 'task':
      return {
        shape: 'event',
        id: content.id,
        event: 'task',
        text: content.description ?? content.summary ?? content.taskId,
        ...(content.status === null ? {} : { status: content.status }),
      }
    case 'notification':
      return content.category === 'status'
        ? null
        : { shape: 'event', id: content.id, event: 'status', text: content.text }
    case 'context':
      return { shape: 'event', id: content.id, event: 'context', text: content.text }
    case 'marker':
      return markerRow(content)
    case 'refusal':
      return { shape: 'event', id: content.id, event: 'refusal', text: content.text }
    case 'imageGeneration':
      return imageGenerationRow(content)
    case 'wait':
      return { shape: 'event', id: content.id, event: 'wait', text: `${content.durationMs} ms` }
    case 'diagnostic':
      return { shape: 'event', id: content.id, event: 'diagnostic', text: content.vendorType }
  }
}

// Decoders preserve content semantics; this maps that content to the existing Feed display rows.
function contentRow(content: FeedContent): SessionFeedRow | null {
  switch (content.kind) {
    case 'message':
      if (content.role === 'system')
        return { shape: 'event', id: content.id, event: 'context', text: content.text }
      return content.phase === 'commentary'
        ? { shape: 'thought', id: content.id, text: content.text }
        : { shape: 'prose', id: content.id, role: content.role, text: content.text }
    case 'reasoning':
      return content.text === null
        ? { shape: 'event', id: content.id, event: 'reasoning', text: null }
        : { shape: 'thought', id: content.id, text: content.text }
    case 'media': {
      const source = content.mediaType === 'image' ? mediaUrl(content.source) : null
      return source === null
        ? { shape: 'event', id: content.id, event: 'media', text: content.mediaType }
        : { shape: 'image', id: content.id, role: content.role ?? 'assistant', source }
    }
    case 'reference':
      return {
        shape: 'source',
        id: content.id,
        role: 'assistant',
        label: content.label,
        source: content.target ?? content.text ?? '',
      }
    case 'tool':
      return toolContentRow(content)
    case 'command':
      return commandContentRow(content)
    case 'fileChange':
      return fileChangeRow(content)
    default:
      return otherContentRow(content)
  }
}

function contentRows(content: FeedContent): SessionFeedRow[] {
  const row = contentRow(content)
  if (row === null) return []
  if (content.kind === 'tool') return [row, ...toolOutputRows(content)]
  return [row]
}

function liveRows(event: SessionLiveEvent): SessionFeedRow[] {
  switch (event.type) {
    case 'content':
      return contentRows(event.content)
    case 'status':
      return [
        {
          shape: 'event',
          id: `status:${event.vendorEventId ?? event.sequence}`,
          event: 'liveStatus',
          text: event.status,
        },
      ]
    case 'permission':
      return [
        {
          shape: 'event',
          id: event.requestId,
          event: permissionEventKind(event.decision),
          text: event.description,
        },
      ]
    case 'question':
      return [
        {
          shape: 'ask',
          id: event.requestId,
          questions: event.questions,
          answer: event.answer,
          unsupported: null,
        },
      ]
    case 'failure':
      return [
        {
          shape: 'event',
          id: `failure:${event.sequence}`,
          event: 'liveFailure',
          text: null,
        },
      ]
  }
}

function rowKey(row: SessionFeedRow): string {
  const id = row.shape === 'prose' || row.shape === 'thought' ? row.id.replace(/:0$/, '') : row.id
  return id
}

type IndexedRows = { rows: SessionFeedRow[]; index: Map<string, number> }
type LiveRow = { key: string; row: SessionFeedRow; sequence: number }

function historyFeedRows(history: readonly FeedContent[], questionCalls: Set<string>): IndexedRows {
  const historyRows: SessionFeedRow[] = []
  const historyIndex = new Map<string, number>()
  const tools = new Map<string, Extract<FeedContent, { kind: 'tool' }>>()
  const progress = new Map<string, Extract<FeedContent, { kind: 'task' | 'delegation' }>>()
  for (const content of history) {
    if (content.kind === 'tool' && questionCalls.has(content.callId)) continue
    const joined = joinContent(content, tools, progress)
    for (const row of contentRows(joined)) {
      const key = rowKey(row)
      const prior = historyIndex.get(key)
      if (prior === undefined) {
        historyIndex.set(key, historyRows.length)
        historyRows.push(row)
      } else historyRows[prior] = row
    }
  }
  return { rows: historyRows, index: historyIndex }
}

function liveFeedRows(live: readonly SessionLiveEvent[], questionCalls: Set<string>): LiveRow[] {
  const rows: LiveRow[] = []
  const liveIndex = new Map<string, number>()
  const tools = new Map<string, Extract<FeedContent, { kind: 'tool' }>>()
  const progress = new Map<string, Extract<FeedContent, { kind: 'task' | 'delegation' }>>()
  for (const event of live) {
    if (
      event.type === 'content' &&
      event.content.kind === 'tool' &&
      questionCalls.has(event.content.callId)
    )
      continue
    const joined =
      event.type === 'content'
        ? { ...event, content: joinContent(event.content, tools, progress) }
        : event
    for (const row of liveRows(joined)) {
      const key = rowKey(row)
      const prior = liveIndex.get(key)
      if (prior === undefined) {
        liveIndex.set(key, rows.length)
        rows.push({ key, row, sequence: event.sequence })
      } else rows[prior] = { key, row, sequence: event.sequence }
    }
  }
  return rows
}

function mergeFeedRows(history: IndexedRows, live: LiveRow[], settledThrough: number) {
  const { rows: historyRows, index: historyIndex } = history
  const firstMatch = live
    .map(({ key }) => historyIndex.get(key))
    .find((position) => position !== undefined)
  const rows = historyRows.slice(0, firstMatch ?? historyRows.length)
  let nextHistory = firstMatch ?? historyRows.length
  for (const current of live) {
    const matched = historyIndex.get(current.key)
    if (matched === undefined) {
      rows.push(current.row)
      continue
    }
    if (matched < nextHistory) continue
    rows.push(...historyRows.slice(nextHistory, matched))
    rows.push(
      current.sequence <= settledThrough ? (historyRows[matched] ?? current.row) : current.row,
    )
    nextHistory = matched + 1
  }
  rows.push(...historyRows.slice(nextHistory))
  return rows
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
  return mergeFeedRows(
    historyFeedRows(history, questionCalls),
    liveFeedRows(sortedLive, questionCalls),
    settledThrough,
  )
}
