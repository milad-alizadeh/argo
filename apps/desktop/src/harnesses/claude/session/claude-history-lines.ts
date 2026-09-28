import path from 'node:path'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange, HistoryTurn } from '@/harnesses/registration'
import { decodeClaudeHistoryContent } from './claude-feed-decoder'

const chainedRecordSchema = z.looseObject({
  type: z.string(),
  uuid: z.string().min(1).optional(),
  parentUuid: z.string().min(1).nullable().optional(),
  logicalParentUuid: z.string().min(1).nullable().optional(),
  isSidechain: z.boolean().optional(),
})
// The records `getSessionMessages` keeps, by the same test the Agent SDK applies to a transcript.
const conversationRecordSchema = z.looseObject({
  type: z.enum(['user', 'assistant']),
  uuid: z.string().min(1),
  message: z.unknown(),
  isMeta: z.literal(true).optional(),
  isSidechain: z.boolean().optional(),
  teamName: z.string().optional(),
})

const turnRecordSchema = z.looseObject({
  type: z.string(),
  subtype: z.string().optional(),
  isMeta: z.literal(true).optional(),
  isSidechain: z.boolean().optional(),
  message: z
    .looseObject({
      stop_reason: z.string().nullable().optional(),
      content: z.union([z.string(), z.array(z.looseObject({ type: z.string() }))]).optional(),
    })
    .optional(),
})
const textBlockSchema = z.looseObject({ type: z.literal('text'), text: z.string() })
const CLOSING_STOP_REASONS = new Set(['end_turn', 'stop_sequence'])

function promptTexts(content: unknown): string[] | null {
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return null
  const texts = content.flatMap((block) => {
    const text = textBlockSchema.safeParse(block)
    return text.success ? [text.data.text] : []
  })
  return texts.length > 0 ? texts : null
}

// A person's prompt opens a turn; the final answer, the turn's duration line or an interruption closes it.
export function claudeHistoryTurn(line: string): HistoryTurn | null {
  const record = turnRecordSchema.safeParse(recordOf(line))
  if (!record.success) return null
  const { type, subtype, isMeta, isSidechain, message } = record.data
  if (isSidechain === true || isMeta === true) return null
  if (type === 'system') return subtype === 'turn_duration' ? 'closed' : null
  if (type === 'assistant')
    return CLOSING_STOP_REASONS.has(message?.stop_reason ?? '') ? 'closed' : null
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

function recordOf(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

function contentEvents(value: unknown, reject: () => void): SessionLiveEventBody[] {
  const record = conversationRecordSchema.safeParse(value)
  if (!record.success) return []
  const { isMeta, isSidechain, teamName, uuid } = record.data
  if (isMeta === true || isSidechain === true || teamName !== undefined) return []
  const message = { ...record.data, session_id: '', parent_tool_use_id: null }
  return decodeClaudeHistoryContent(message as SessionMessage, reject).map((content) => ({
    type: 'content',
    commandId: null,
    turnId: null,
    vendorEventId: uuid,
    content,
  }))
}

type ChainStep = { leaf: string | null; branched: boolean; events: SessionLiveEventBody[] }

// One transcript line against the chain's current leaf; a line that is not a record is rejected.
function chainStep(leaf: string | null, line: string, reject: () => void): ChainStep {
  const value = recordOf(line)
  const record = chainedRecordSchema.safeParse(value)
  if (!record.success) {
    reject()
    return { leaf, branched: false, events: [] }
  }
  const { uuid, parentUuid, logicalParentUuid, isSidechain } = record.data
  if (uuid === undefined || isSidechain === true) return { leaf, branched: false, events: [] }
  // A compaction boundary starts a new root that names the old leaf as its logical parent.
  const branched = leaf !== null && (parentUuid ?? logicalParentUuid) !== leaf
  return { leaf: uuid, branched, events: contentEvents(value, reject) }
}

// A full read follows the parent chain from the newest leaf, so a record that branches off an
// earlier one cannot be read as an append: the reader reports the file as rewritten instead.
export function openClaudeHistoryReader(): (lines: readonly string[]) => HistoryChange {
  let leaf: string | null = null
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
