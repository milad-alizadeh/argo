import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { HistoryChange, SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import { claudeFeedContent } from './claude-feed'
import { ClaudeFeedProjection } from './claude-feed-projection'

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function historyRecord(line: string): Record<string, unknown> | null {
  try {
    const record = jsonObject(JSON.parse(line))
    return typeof record?.type === 'string' ? record : null
  } catch {
    return null
  }
}

function contentEvents(
  record: Record<string, unknown>,
  reject: () => void,
  projection: ClaudeFeedProjection,
): SessionLiveEventBody[] {
  if (record.type !== 'user' && record.type !== 'assistant') return []
  const { isMeta, isSidechain, teamName, uuid } = record
  if (typeof uuid !== 'string' || uuid === '') return []
  if (isMeta === true || isSidechain === true || teamName !== undefined) return []
  const message = { ...record, session_id: '', parent_tool_use_id: null }
  const decoded = claudeFeedContent(message as unknown as SDKMessage, reject)
  return decoded
    .flatMap((content) => projection.project(content))
    .map((content) => ({
      type: 'content',
      commandId: null,
      turnId: null,
      vendorEventId: uuid,
      content,
    }))
}

type ChainStep = { leaf: string | null; branched: boolean; events: SessionLiveEventBody[] }

// The chain's leaf after one record, and whether that record branched off an earlier one.
function chainLink(
  leaf: string | null,
  record: Record<string, unknown>,
): Omit<ChainStep, 'events'> | null {
  const { uuid, parentUuid, logicalParentUuid, isSidechain } = record
  if (typeof uuid !== 'string' || uuid === '' || isSidechain === true) return null
  const parent = typeof parentUuid === 'string' ? parentUuid : null
  const logicalParent = typeof logicalParentUuid === 'string' ? logicalParentUuid : null
  // A compaction boundary starts a new root that names the old leaf as its logical parent.
  return { leaf: uuid, branched: leaf !== null && (parent ?? logicalParent) !== leaf }
}

// One transcript line against the chain's current leaf; a line that is not a record is rejected.
function chainStep(
  leaf: string | null,
  line: string,
  decoder: {
    reject: () => void
    projection: ClaudeFeedProjection
  },
): ChainStep {
  const value = historyRecord(line)
  if (value === null) {
    decoder.reject()
    return { leaf, branched: false, events: [] }
  }
  const link = chainLink(leaf, value)
  if (link === null) return { leaf, branched: false, events: [] }
  return { ...link, events: contentEvents(value, decoder.reject, decoder.projection) }
}

function leafOf(lines: readonly string[]): string | null {
  let leaf: string | null = null
  for (const line of lines) {
    const record = historyRecord(line)
    if (record !== null) leaf = chainLink(leaf, record)?.leaf ?? leaf
  }
  return leaf
}

// A full read follows the parent chain from the newest leaf, so a record that branches off an
// earlier one cannot be read as an append: the reader reports the file as rewritten instead.
export function openClaudeHistoryReader(
  existing: readonly string[] = [],
): (lines: readonly string[]) => HistoryChange {
  let leaf = leafOf(existing)
  // Decodes as a full read does; the lines already read teach it the calls a new result answers.
  const projection = new ClaudeFeedProjection()
  for (const line of existing) {
    const record = historyRecord(line)
    if (record !== null) contentEvents(record, () => {}, projection)
  }
  return (lines) => {
    let rejected = 0
    const reject = () => {
      rejected += 1
    }
    const events: SessionLiveEventBody[] = []
    let branched = false
    for (const line of lines) {
      const step = chainStep(leaf, line, { reject, projection })
      leaf = step.leaf
      branched ||= step.branched
      events.push(...step.events)
    }
    if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude history line(s).`)
    return branched ? { type: 'rewritten' } : { type: 'appended', events }
  }
}
