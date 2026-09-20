import { readFile } from 'node:fs/promises'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { TranscriptRecord } from '@/domains/sessions/contract/model/transcript'
import { transcriptFileFrom } from '@/domains/sessions/contract/model/transcript'
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
  type TranscriptDiscoveryOptions,
} from '@/domains/sessions/main/observation/discover-transcript-sessions'
import { createTranscriptRecordReader } from '@/domains/sessions/main/observation/transcript-lines'
import { isRecord } from '@/shared/validation'
import { withoutModelInputCopies } from './model-input-copies'
import { answeringEveryNestedCall } from './nested-results'
import { parseCodexTranscriptLine } from './records'
import { readingSubagentCalls } from './subagent-calls'
import type { ThreadNames } from './thread-names'
import { transcriptPaths } from './transcript-paths'

export type Discovery = TranscriptDiscovery

function withoutDuplicateMessages(records: TranscriptRecord[]): TranscriptRecord[] {
  const messageIds = new Set<string>()
  return records.filter((record) => {
    if (record.kind !== 'message') return true
    if (messageIds.has(record.uuid)) return false
    messageIds.add(record.uuid)
    return true
  })
}

// A subagent thread is dispatched programmatically, never by a person, so it never writes the
// `user_message` event a title needs and would otherwise surface in the Roster named by its raw
// uuid. Dropping every record once the file's own `session_meta` names it a subagent thread
// keeps that filtering in the Codex adapter rather than teaching shared discovery about `cli`.
function droppingSubagentThreads(records: TranscriptRecord[]): TranscriptRecord[] {
  const isSubagentThread = records.some((record) => record.kind === 'trace' && record.subagent)
  return isSubagentThread ? [] : records
}

export function normalizeCodexMessageRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return readingSubagentCalls(
    answeringEveryNestedCall(withoutModelInputCopies(withoutDuplicateMessages(records))),
  )
}

export function normalizeCodexRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return droppingSubagentThreads(normalizeCodexMessageRecords(records))
}

const reader = createTranscriptDiscoverer({
  cli: 'codex',
  transcriptPaths,
  parse: parseCodexTranscriptLine,
  normalizeRecords: normalizeCodexRecords,
})

export const {
  clearFullRecords,
  readSessionFiles,
  backfillTick,
  reconcileAll,
  resolveIds,
  historyComplete,
  searchIndexed,
} = reader
const { readRecords } = createTranscriptRecordReader(parseCodexTranscriptLine)

function spawnTaskName(line: string, subagentId: string): string | null {
  let record: unknown
  try {
    record = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(record) || record.type !== 'response_item' || !isRecord(record.payload)) return null
  const payload = record.payload
  if (
    payload.type !== 'function_call' ||
    payload.call_id !== subagentId ||
    payload.name !== 'spawn_agent' ||
    typeof payload.arguments !== 'string'
  )
    return null
  try {
    const input: unknown = JSON.parse(payload.arguments)
    return isRecord(input) && typeof input.task_name === 'string' ? input.task_name : null
  } catch {
    return null
  }
}

async function taskName(chain: Awaited<ReturnType<typeof readSessionFiles>>, subagentId: string) {
  for (const file of chain?.files ?? []) {
    const text = await readFile(file.path, 'utf8').catch(() => null)
    if (text === null) continue
    const name = text
      .split('\n')
      .map((line) => spawnTaskName(line, subagentId))
      .find((candidate) => candidate !== null)
    if (name !== undefined) return name
  }
  return null
}

// Codex stores each spawned agent as a normal transcript, deliberately omitted from the Roster.
// Its metadata gives the exact parent Session and task path, so opening one card can locate and
// read that one transcript without teaching shared Session code about Codex's file format.
export async function readSubagentFiles(root: string, sessionId: string, subagentId: string) {
  const parent = await readSessionFiles(root, sessionId)
  const name = await taskName(parent, subagentId)
  if (name === null) return null
  const paths = await transcriptPaths(root)
  const matches = []
  for (const file of paths) {
    const records = await readRecords(file.path).catch(() => null)
    if (records === null) continue
    const trace = records.find(
      (record) =>
        record.kind === 'trace' &&
        record.subagent === true &&
        record.parentSessionId === sessionId &&
        record.agentPath?.endsWith(`/${name}`) === true,
    )
    if (trace !== undefined)
      matches.push({
        id: subagentId,
        retiredIds: [],
        files: [transcriptFileFrom(file.path, { sessionId: file.sessionId, records })],
        originUnread: false,
      })
  }
  return matches.length === 1 ? (matches[0] ?? null) : null
}

// Codex writes no thread name to a rollout, so its own name outranks the opening prompt (ADR-0042).
// It reads as `summarised`: Codex names most threads itself, and a person's rename lands there too.
function named(row: SessionRosterRow, names: ReadonlyMap<string, string>): SessionRosterRow {
  const name = [row.id, ...row.retiredIds].map((id) => names.get(id)).find(Boolean)
  return name === undefined ? row : { ...row, title: { text: name, source: 'summarised' } }
}

export function nameThreads(rows: SessionRosterRow[], threadNames: ThreadNames) {
  const names = threadNames(rows.flatMap((row) => [row.id, ...row.retiredIds]))
  return rows.map((row) => named(row, names))
}

export function discoverSessions(
  root: string,
  options?: TranscriptDiscoveryOptions,
): Promise<Discovery> {
  return reader.discoverSessions(root, options)
}
