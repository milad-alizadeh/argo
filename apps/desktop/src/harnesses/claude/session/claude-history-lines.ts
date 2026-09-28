import path from 'node:path'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange, HistoryTurn } from '@/harnesses/registration'
import { decodeClaudeHistoryContent } from './claude-feed-decoder'

const CLOSING_STOP_REASONS = new Set(['end_turn', 'stop_sequence'])

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function promptTexts(content: unknown): string[] | null {
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return null
  const texts = content.flatMap((block) => {
    const text = object(block)
    return text?.type === 'text' && typeof text.text === 'string' ? [text.text] : []
  })
  return texts.length > 0 ? texts : null
}

// A person's prompt opens a turn; the final answer, the turn's duration line or an interruption closes it.
export function claudeHistoryTurn(line: string): HistoryTurn | null {
  const record = recordOf(line)
  if (record === null) return null
  const { type, subtype, isMeta, isSidechain } = record
  const message = object(record.message)
  if (isSidechain === true || isMeta === true) return null
  if (type === 'system') return subtype === 'turn_duration' ? 'closed' : null
  if (type === 'assistant')
    return CLOSING_STOP_REASONS.has(
      typeof message?.stop_reason === 'string' ? message.stop_reason : '',
    )
      ? 'closed'
      : null
  if (type !== 'user') return null
  const texts = promptTexts(message?.content)
  if (texts === null) return null
  return texts.some((text) => text.startsWith('[Request interrupted by user')) ? 'closed' : 'open'
}

// `<project>/<sessionId>.jsonl`, and `<project>/<sessionId>/subagents/agent-<id>.jsonl`.
export function claudeHistoryOwner(relativePath: string): string | null {
  if (path.extname(relativePath) !== '.jsonl') return null
  return path.basename(relativePath, '.jsonl').replace(/^agent-/, '')
}

function recordOf(line: string): Record<string, unknown> | null {
  try {
    const record = object(JSON.parse(line))
    return typeof record?.type === 'string' ? record : null
  } catch {
    return null
  }
}

function contentEvents(
  record: Record<string, unknown>,
  reject: () => void,
): SessionLiveEventBody[] {
  if (record.type !== 'user' && record.type !== 'assistant') return []
  const { isMeta, isSidechain, teamName, uuid } = record
  if (typeof uuid !== 'string' || uuid === '') return []
  if (isMeta === true || isSidechain === true || teamName !== undefined) return []
  const message = { ...record, session_id: '', parent_tool_use_id: null }
  return decodeClaudeHistoryContent(message as SessionMessage, reject).map((content) => ({
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
function chainStep(leaf: string | null, line: string, reject: () => void): ChainStep {
  const value = recordOf(line)
  if (value === null) {
    reject()
    return { leaf, branched: false, events: [] }
  }
  const link = chainLink(leaf, value)
  if (link === null) return { leaf, branched: false, events: [] }
  return { ...link, events: contentEvents(value, reject) }
}

function leafOf(lines: readonly string[]): string | null {
  let leaf: string | null = null
  for (const line of lines) {
    const record = recordOf(line)
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
  return (lines) => {
    let rejected = 0
    const reject = () => {
      rejected += 1
    }
    const events: SessionLiveEventBody[] = []
    let branched = false
    for (const line of lines) {
      const step = chainStep(leaf, line, reject)
      leaf = step.leaf
      branched ||= step.branched
      events.push(...step.events)
    }
    if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude history line(s).`)
    return branched ? { type: 'rewritten' } : { type: 'appended', events }
  }
}
