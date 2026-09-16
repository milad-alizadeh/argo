import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
} from '@/core/sessions/discover-transcript-sessions'
import type { SessionRosterRow } from '@/core/sessions/models'
import type { TranscriptRecord } from '@/core/sessions/transcript'
import { withoutModelInputCopies } from './model-input-copies'
import { parseCodexTranscriptLine } from './records'
import type { ThreadNames } from './thread-names'

export type Discovery = TranscriptDiscovery

async function directories(root: string): Promise<string[]> {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
}

async function transcriptPathsInDay(root: string) {
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
    .map((entry) => ({ path: path.join(root, entry.name), name: sessionIdFileName(entry.name) }))
}

function sessionIdFileName(fileName: string) {
  const sessionId = fileName.match(/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.jsonl$/i)?.[1]
  return sessionId === undefined ? fileName : `${sessionId}.jsonl`
}

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
  return withoutModelInputCopies(withoutDuplicateMessages(records))
}

export function normalizeCodexRecords(records: TranscriptRecord[]): TranscriptRecord[] {
  return droppingSubagentThreads(normalizeCodexMessageRecords(records))
}

export async function transcriptPaths(root: string): Promise<{ path: string; name: string }[]> {
  const years = await directories(root)
  const months = (await Promise.all(years.map(directories))).flat()
  const days = (await Promise.all(months.map(directories))).flat()
  return (await Promise.all(days.map(transcriptPathsInDay))).flat()
}

const reader = createTranscriptDiscoverer({
  cli: 'codex',
  transcriptPaths,
  parse: parseCodexTranscriptLine,
  normalizeRecords: normalizeCodexRecords,
})

export const { clearFullRecords, readSessionFiles } = reader

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
  options?: { cursor?: string | null },
): Promise<Discovery> {
  return reader.discoverSessions(root, options)
}
