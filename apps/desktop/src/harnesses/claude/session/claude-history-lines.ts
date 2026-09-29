import path from 'node:path'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange, HistoryTurn, HistoryTurnMarker } from '@/harnesses/registration'
import { decodeClaudeHistoryContent } from './claude-feed-decoder'
import { ClaudeFeedProjection } from './claude-feed-projection'
import { type ClaudeSkillFile, claudeSkillFiles } from './claude-skill-files'
import { ClaudeSkillDirectoryScan } from './claude-skill-records'

const CLOSING_STOP_REASONS = new Set(['end_turn', 'stop_sequence'])

export function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function promptTexts(content: unknown): string[] | null {
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return null
  const texts = content.flatMap((block) => {
    const text = jsonObject(block)
    return text?.type === 'text' && typeof text.text === 'string' ? [text.text] : []
  })
  return texts.length > 0 ? texts : null
}

// A person's prompt opens a turn; the final answer, the turn's duration line or an interruption
// closes it. Claude writes no turn id, so the newest marker stands.
export function claudeHistoryTurn(line: string): HistoryTurnMarker | null {
  const turn = claudeTurn(line)
  return turn === null ? null : { turn, turnId: null }
}

function claudeTurn(line: string): HistoryTurn | null {
  const record = historyRecord(line)
  if (record === null) return null
  const { type, subtype, isMeta, isSidechain } = record
  const message = jsonObject(record.message)
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

export function historyRecord(line: string): Record<string, unknown> | null {
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
  const decoded = decodeClaudeHistoryContent(message as SessionMessage, reject)
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
    learnCwd: (record: Record<string, unknown> | null) => void
  },
): ChainStep {
  const value = historyRecord(line)
  decoder.learnCwd(value)
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
  // Skills resolve against the Session's folder, which discovery also reads from its first record.
  const homeSkills = claudeSkillFiles(null)
  let skillFile: ClaudeSkillFile | null = null
  const resolveSkill = (name: string) => (skillFile ?? homeSkills)(name)
  const learnCwd = (record: Record<string, unknown> | null) => {
    if (skillFile === null && typeof record?.cwd === 'string')
      skillFile = claudeSkillFiles(record.cwd)
  }
  // The folders the transcript records, read from the same lines; a row prefers them to disk.
  const skills = new ClaudeSkillDirectoryScan()
  skills.read(existing)
  // Decodes as a full read does; the lines already read teach it the calls a new result answers.
  const projection = new ClaudeFeedProjection(resolveSkill, () => skills.directories)
  for (const line of existing) {
    const record = historyRecord(line)
    learnCwd(record)
    if (record !== null) contentEvents(record, () => {}, projection)
  }
  return (lines) => {
    // Scanned first, so an invocation and the folder recorded after it land in one batch.
    skills.read(lines)
    let rejected = 0
    const reject = () => {
      rejected += 1
    }
    const events: SessionLiveEventBody[] = []
    let branched = false
    for (const line of lines) {
      const step = chainStep(leaf, line, { reject, projection, learnCwd })
      leaf = step.leaf
      branched ||= step.branched
      events.push(...step.events)
    }
    if (rejected > 0) console.warn(`Rejected ${rejected} unsupported Claude history line(s).`)
    return branched ? { type: 'rewritten' } : { type: 'appended', events }
  }
}
