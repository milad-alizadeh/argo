import type { FeedContent, MediaSource } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { BackgroundState } from './background-task-record'
import { checkedDataImageUrl, dataImageUrl, fileImageUrl } from './feed-images'
import type { SessionFeedRow } from './feed-rows'
import { derivedId } from './fingerprint'
import type { ToolCall } from './tool-call'
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

function promptRow(content: Extract<FeedContent, { kind: 'message' }>): SessionFeedRow {
  const images = (content.images ?? []).flatMap((source) => {
    const url = mediaUrl(source)
    return url === null ? [] : [url]
  })
  const files = (content.files ?? []).map((file) => file.target)
  return {
    shape: 'prose',
    id: content.id,
    role: content.role as 'user' | 'assistant',
    text: content.text,
    ...(images.length > 0 ? { images } : {}),
    ...(files.length > 0 ? { files } : {}),
    ...(content.pastedContent === undefined ? {} : { pastedContent: content.pastedContent }),
  }
}

function toolOutputRows(content: Extract<FeedContent, { kind: 'tool' }>): SessionFeedRow[] {
  return (content.output ?? []).flatMap((part, index): SessionFeedRow[] => {
    const id = derivedId(content.callId, `:output:${index}`)
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
      callId: update.callId ?? earlier.callId,
      status: update.status ?? earlier.status,
      description: update.description ?? earlier.description,
      summary: update.summary ?? earlier.summary,
    }
  if (update.kind === 'delegation' && earlier.kind === 'delegation')
    return {
      ...update,
      name: update.name ?? earlier.name,
      prompt: update.prompt ?? earlier.prompt,
      model: update.model ?? earlier.model,
      summary: update.summary ?? earlier.summary,
    }
  return update
}

function joinContent(
  content: FeedContent,
  { tools, progress, agents }: Omit<ProjectionState, 'questionCalls'>,
): FeedContent {
  switch (content.kind) {
    case 'tool': {
      const joined = mergeToolContent(tools.get(content.callId), content)
      tools.set(content.callId, joined)
      return joined
    }
    case 'task': {
      const joined = mergeProgressContent(progress.get(content.taskId), content)
      const stable = { ...joined, id: content.taskId }
      progress.set(content.taskId, stable)
      return stable
    }
    case 'delegation': {
      const joined = mergeProgressContent(progress.get(content.id), content)
      progress.set(content.id, joined)
      return joined.kind === 'delegation' ? withAgentFacts(joined, agents) : joined
    }
    default:
      return content
  }
}

type Delegation = Extract<FeedContent, { kind: 'delegation' }>
type AgentFacts = Map<string, { name: string | null; model: string | null }>

const RESPONSE_STATES = {
  pending: null,
  running: null,
  paused: null,
  completed: 'completed',
  failed: 'failed',
  interrupted: 'interrupted',
} as const satisfies Record<Delegation['status'], BackgroundState | null>

// A later event names the Subagent only when its own record does; its start said who it was.
function withAgentFacts(content: Delegation, agents: AgentFacts): Delegation {
  const known = agents.get(content.agentId)
  const name = content.name ?? known?.name ?? null
  const model = content.model ?? known?.model ?? null
  agents.set(content.agentId, { name, model })
  return { ...content, name, model }
}

function delegationContentRow(content: Delegation): SessionFeedRow {
  const facts = {
    shape: 'subagent',
    id: content.id,
    subagentId: content.agentId,
    ...(content.name === null ? {} : { name: content.name }),
    ...(content.model === null ? {} : { model: content.model }),
  } as const
  switch (content.event) {
    case 'started':
    case 'messaged':
      return {
        ...facts,
        event: content.event,
        ...(content.prompt === null ? {} : { prompt: content.prompt }),
      }
    case 'responded': {
      const state = RESPONSE_STATES[content.status]
      return {
        ...facts,
        event: 'responded',
        ...(state === null ? {} : { state }),
        ...(content.summary === null ? {} : { text: content.summary }),
      }
    }
  }
}

function referenceContentRow(content: Extract<FeedContent, { kind: 'reference' }>): SessionFeedRow {
  if (content.referenceType !== 'skill')
    return { shape: 'event', id: content.id, event: 'context', text: content.text ?? content.label }
  return {
    shape: 'event',
    id: content.id,
    event: 'skill-invocation',
    text: content.text === null ? content.label : `${content.label} ${content.text}`,
    ...(content.target === null ? {} : { skill: { name: content.label, path: content.target } }),
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

function fileChangeEvidence(
  change: Extract<FeedContent, { kind: 'fileChange' }>['changes'][number],
): string {
  const text = change.diff ?? ''
  switch (change.change) {
    case 'add':
    case 'delete': {
      const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n')
      const added = change.change === 'add'
      const verb = added ? 'Add' : 'Delete'
      const oldRange = added || lines.length === 0 ? '0,0' : `1,${lines.length}`
      const newRange = !added || lines.length === 0 ? '0,0' : `1,${lines.length}`
      const prefix = added ? '+' : '-'
      return [
        `${verb} File: ${change.path}`,
        `@@ -${oldRange} +${newRange} @@`,
        ...lines.map((line) => `${prefix}${line}`),
      ].join('\n')
    }
    case 'update':
    case 'unknown':
      return `Update File: ${change.path}\n${text}`
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
      source: content.changes.map(fileChangeEvidence).join('\n'),
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

function eventContentRow(
  content: FeedContent,
  event: Extract<SessionFeedRow, { shape: 'event' }>['event'],
  text: string | null,
): Extract<SessionFeedRow, { shape: 'event' }> {
  return { shape: 'event', id: content.id, event, text }
}

function taskContentRow(
  content: Extract<FeedContent, { kind: 'task' }>,
): Extract<SessionFeedRow, { shape: 'event' }> {
  return {
    ...eventContentRow(content, 'task', content.description ?? content.summary ?? content.taskId),
    ...(content.status === null ? {} : { status: content.status }),
  }
}

function notificationContentRow(
  content: Extract<FeedContent, { kind: 'notification' }>,
): SessionFeedRow | null {
  return content.category === 'status' ? null : eventContentRow(content, 'status', content.text)
}

// Decoders preserve content semantics; this maps that content to the existing Feed display rows.
function contentRow(content: FeedContent): SessionFeedRow | null {
  switch (content.kind) {
    // A system context update is instruction to the model, never something the reader follows.
    case 'message':
      if (content.role === 'system') return null
      if (content.phase === 'commentary')
        return { shape: 'thought', id: content.id, text: content.text }
      return promptRow(content)
    // Reasoning the Harness withholds has nothing to read, so it draws no row.
    case 'reasoning':
      return content.text === null || content.text.trim() === ''
        ? null
        : { shape: 'thought', id: content.id, text: content.text }
    case 'media': {
      const source = content.mediaType === 'image' ? mediaUrl(content.source) : null
      return source === null
        ? { shape: 'event', id: content.id, event: 'media', text: content.mediaType }
        : { shape: 'image', id: content.id, role: content.role ?? 'assistant', source }
    }
    case 'reference':
      return referenceContentRow(content)
    case 'tool':
      return toolContentRow(content)
    case 'command':
      return commandContentRow(content)
    case 'fileChange':
      return fileChangeRow(content)
    case 'delegation':
      return delegationContentRow(content)
    case 'search':
      return eventContentRow(content, content.kind, content.query)
    case 'plan':
      return eventContentRow(content, content.kind, content.text)
    case 'task':
      return taskContentRow(content)
    case 'notification':
      return notificationContentRow(content)
    case 'context':
      return null
    case 'marker':
      return markerRow(content)
    case 'refusal':
      return eventContentRow(content, content.kind, content.text)
    case 'imageGeneration':
      return imageGenerationRow(content)
    case 'wait':
      return eventContentRow(content, content.kind, `${content.durationMs} ms`)
    case 'diagnostic':
      return eventContentRow(content, content.kind, content.vendorType)
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

export function rowKey(row: SessionFeedRow): string {
  const id = row.shape === 'prose' || row.shape === 'thought' ? row.id.replace(/:0$/, '') : row.id
  return `${row.shape}:${id}`
}

type IndexedRows = { rows: SessionFeedRow[]; index: Map<string, number> }
type LiveRow = { key: string; row: SessionFeedRow; sequence: number }
type ProjectionState = {
  questionCalls: Set<string>
  tools: Map<string, Extract<FeedContent, { kind: 'tool' }>>
  progress: Map<string, Extract<FeedContent, { kind: 'task' | 'delegation' }>>
  agents: AgentFacts
}

function projectedContentRows(content: FeedContent, state: ProjectionState): SessionFeedRow[] {
  if (content.kind === 'tool' && state.questionCalls.has(content.callId)) return []
  return contentRows(joinContent(content, state))
}

function upsertRows<Row>(
  target: { rows: Row[]; index: Map<string, number> },
  projected: SessionFeedRow[],
  makeRow: (key: string, row: SessionFeedRow) => Row,
) {
  for (const row of projected) {
    const key = rowKey(row)
    const prior = target.index.get(key)
    const next = makeRow(key, row)
    if (prior === undefined) {
      target.index.set(key, target.rows.length)
      target.rows.push(next)
    } else target.rows[prior] = next
  }
}

function historyFeedRows(history: readonly FeedContent[], questionCalls: Set<string>): IndexedRows {
  const historyRows: SessionFeedRow[] = []
  const historyIndex = new Map<string, number>()
  const state: ProjectionState = {
    questionCalls,
    tools: new Map(),
    progress: new Map(),
    agents: new Map(),
  }
  for (const content of history) {
    upsertRows(
      { rows: historyRows, index: historyIndex },
      projectedContentRows(content, state),
      (_key, row) => row,
    )
  }
  return { rows: historyRows, index: historyIndex }
}

function liveFeedRows(live: readonly SessionLiveEvent[], questionCalls: Set<string>): LiveRow[] {
  const rows: LiveRow[] = []
  const liveIndex = new Map<string, number>()
  const state: ProjectionState = {
    questionCalls,
    tools: new Map(),
    progress: new Map(),
    agents: new Map(),
  }
  for (const event of live) {
    const projected =
      event.type === 'content' ? projectedContentRows(event.content, state) : liveRows(event)
    upsertRows({ rows, index: liveIndex }, projected, (key, row) => ({
      key,
      row,
      sequence: event.sequence,
    }))
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
