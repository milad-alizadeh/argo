import { rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import { matchesSearchQuery } from '../../projection'
import {
  type BackfillProgress,
  type IndexedTranscriptFile,
  NO_CHAIN,
  type SessionIndexWrite,
} from './contract'
import { SESSION_INDEX_SCHEMA, SESSION_INDEX_VERSION } from './schema'
import { storedRosterRow } from './stored-row'

type BackfillRecord = {
  boundary_written_at: number | null
  boundary_path: string | null
  complete: number
}

function backfillProgressOf(database: DatabaseSync, harness: string): BackfillProgress {
  const record = database
    .prepare(
      'SELECT boundary_written_at, boundary_path, complete FROM backfill_progress WHERE harness = ?',
    )
    .get(harness) as BackfillRecord | undefined
  if (record === undefined) return { boundary: null, complete: false }
  const boundary =
    record.boundary_written_at === null || record.boundary_path === null
      ? null
      : { writtenAt: record.boundary_written_at, path: record.boundary_path }
  return { boundary, complete: record.complete === 1 }
}

function writeBackfillProgress(database: DatabaseSync, harness: string, progress: BackfillProgress) {
  database
    .prepare(
      `INSERT OR REPLACE INTO backfill_progress (harness, boundary_written_at, boundary_path, complete)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      harness,
      progress.boundary?.writtenAt ?? null,
      progress.boundary?.path ?? null,
      progress.complete ? 1 : 0,
    )
}

const SEARCH_EXCERPT_RADIUS = 80

function plainTextSearchQuery(query: string): string {
  return (query.match(/[\p{L}\p{N}_]+/gu) ?? []).map((word) => `"${word}"`).join(' AND ')
}

function searchExcerptOf(text: string, query: string): string | null {
  const needle = query.match(/[\p{L}\p{N}_]+/gu)?.[0]
  if (needle === undefined) return null
  const start = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase())
  if (start < 0) return null
  const from = Math.max(0, start - SEARCH_EXCERPT_RADIUS)
  const to = Math.min(text.length, start + needle.length + SEARCH_EXCERPT_RADIUS)
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}

function searchChainsOf(database: DatabaseSync, harness: string, query: string): SessionRosterRow[] {
  const titleOrId = database
    .prepare(
      'SELECT chain_id, row_json FROM session_chain WHERE harness = ? ORDER BY updated_at DESC',
    )
    .all(harness) as { chain_id: string; row_json: string }[]
  const content = plainTextSearchQuery(query)
  const contentMatches =
    content === ''
      ? []
      : (database
          .prepare(
            'SELECT chain_id, text FROM session_search WHERE harness = ? AND session_search MATCH ?',
          )
          .all(harness, content) as { chain_id: string; text: string }[])
  const excerpts = new Map(
    contentMatches.map((match) => [match.chain_id, searchExcerptOf(match.text, query)]),
  )
  return titleOrId.flatMap((record) => {
    const row = storedRosterRow(record.row_json)
    if (row === null) return []
    const excerpt = excerpts.get(record.chain_id) ?? null
    if (!matchesSearchQuery(row, query) && excerpt === null) return []
    return excerpt === null ? [row] : [{ ...row, searchExcerpt: excerpt }]
  })
}

function writePass(database: DatabaseSync, harness: string, pass: SessionIndexWrite) {
  const insertFile = database.prepare(
    `INSERT OR REPLACE INTO transcript_file (harness, path, session_id, written_at, size, chain_id) VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const insertChain = database.prepare(
    `INSERT OR REPLACE INTO session_chain (harness, chain_id, updated_at, origin_unread, row_json) VALUES (?, ?, ?, ?, ?)`,
  )
  const dropSearch = database.prepare(
    'DELETE FROM session_search WHERE harness = ? AND chain_id = ?',
  )
  const insertSearch = database.prepare(
    'INSERT INTO session_search (harness, chain_id, text) VALUES (?, ?, ?)',
  )
  const dropChain = database.prepare('DELETE FROM session_chain WHERE harness = ? AND chain_id = ?')
  const insertLink = database.prepare(
    'INSERT OR REPLACE INTO chain_link (harness, session_id, parent_session_id) VALUES (?, ?, ?)',
  )
  const dropFile = database.prepare('DELETE FROM transcript_file WHERE harness = ? AND path = ?')
  const dropChainFiles = database.prepare(
    'DELETE FROM transcript_file WHERE harness = ? AND chain_id = ?',
  )
  database.exec('BEGIN')
  try {
    for (const chain of pass.chains) {
      dropChainFiles.run(harness, chain.chainId)
      dropSearch.run(harness, chain.chainId)
    }
    for (const path of pass.removedPaths) dropFile.run(harness, path)
    for (const chainId of pass.retiredChainIds) {
      dropChain.run(harness, chainId)
      dropSearch.run(harness, chainId)
    }
    for (const file of pass.files)
      insertFile.run(harness, file.path, file.sessionId, file.writtenAt, file.size, file.chainId)
    for (const chain of pass.chains)
      insertChain.run(
        harness,
        chain.chainId,
        chain.updatedAt,
        chain.originUnread ? 1 : 0,
        JSON.stringify(chain.row),
      )
    for (const chain of pass.chains) insertSearch.run(harness, chain.chainId, chain.searchText)
    for (const link of pass.links) insertLink.run(harness, link.sessionId, link.parentSessionId)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export type SessionIndexStore = {
  filesAt: (harness: string, paths: readonly string[]) => IndexedTranscriptFile[]
  filesOfChains: (harness: string, chainIds: readonly string[]) => IndexedTranscriptFile[]
  rowsOfChains: (harness: string, chainIds: readonly string[]) => SessionRosterRow[]
  searchChains: (harness: string, query: string) => SessionRosterRow[]
  chainLinks: (harness: string) => { sessionId: string; parentSessionId: string | null }[]
  strandedChains: (harness: string) => string[]
  write: (harness: string, pass: SessionIndexWrite) => void
  backfillProgress: (harness: string) => BackfillProgress
  setBackfillProgress: (harness: string, progress: BackfillProgress) => void
  close: () => void
}
function placeholders(count: number): string {
  return new Array(count).fill('?').join(', ')
}
function openAtVersion(databasePath: string): DatabaseSync {
  const database = new DatabaseSync(databasePath)
  const version = database.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version.user_version === SESSION_INDEX_VERSION) return database
  if (version.user_version !== 0) {
    // Nothing here is a source of truth, so an index from another version is discarded rather
    // than migrated: the next pass rebuilds it from the transcripts.
    database.close()
    rmSync(databasePath, { force: true })
    return openAtVersion(databasePath)
  }
  database.exec(SESSION_INDEX_SCHEMA)
  database.exec(`PRAGMA user_version = ${SESSION_INDEX_VERSION}`)
  return database
}
function openIndex(databasePath: string): DatabaseSync {
  try {
    return openAtVersion(databasePath)
  } catch {
    rmSync(databasePath, { force: true })
    return openAtVersion(databasePath)
  }
}
type FileRecord = {
  path: string
  session_id: string
  written_at: number
  size: number
  chain_id: string
  row_json: string | null
}
function indexedFile(record: FileRecord): IndexedTranscriptFile {
  return {
    path: record.path,
    sessionId: record.session_id,
    writtenAt: record.written_at,
    size: record.size,
    chainId: record.chain_id,
  }
}
export function createSessionIndexStore(databasePath: string): SessionIndexStore {
  const database = openIndex(databasePath)
  let open = true
  function filesBy(column: 'path' | 'chain_id', harness: string, values: readonly string[]) {
    if (values.length === 0) return []
    const qualifiedColumn = { path: 'file.path', chain_id: 'file.chain_id' }[column]
    const rows = database
      .prepare(
        `SELECT file.path, file.session_id, file.written_at, file.size, file.chain_id,
                chain.row_json
         FROM transcript_file AS file
         LEFT JOIN session_chain AS chain
           ON chain.harness = file.harness AND chain.chain_id = file.chain_id
         WHERE file.harness = ? AND ${qualifiedColumn} IN (${placeholders(values.length)})`,
      )
      .all(harness, ...values) as FileRecord[]
    return rows.flatMap((record) => {
      const unowned = record.chain_id === NO_CHAIN
      return unowned || storedRosterRow(record.row_json) !== null ? [indexedFile(record)] : []
    })
  }
  return {
    filesAt: (harness, paths) => filesBy('path', harness, paths),
    filesOfChains: (harness, chainIds) => filesBy('chain_id', harness, chainIds),
    rowsOfChains(harness, chainIds) {
      if (chainIds.length === 0) return []
      const records = database
        .prepare(
          `SELECT row_json FROM session_chain
           WHERE harness = ? AND chain_id IN (${placeholders(chainIds.length)})
           ORDER BY updated_at DESC`,
        )
        .all(harness, ...chainIds) as { row_json: string }[]
      return records.flatMap((record) => {
        const row = storedRosterRow(record.row_json)
        return row === null ? [] : [row]
      })
    },
    searchChains: (harness, query) => searchChainsOf(database, harness, query),
    strandedChains(harness) {
      const records = database
        .prepare('SELECT chain_id FROM session_chain WHERE harness = ? AND origin_unread = 1')
        .all(harness) as { chain_id: string }[]
      return records.map((record) => record.chain_id)
    },
    chainLinks(harness) {
      const records = database
        .prepare('SELECT session_id, parent_session_id FROM chain_link WHERE harness = ?')
        .all(harness) as { session_id: string; parent_session_id: string | null }[]
      return records.map((record) => ({
        sessionId: record.session_id,
        parentSessionId: record.parent_session_id,
      }))
    },
    write: (harness, pass) => writePass(database, harness, pass),

    backfillProgress: (harness) => backfillProgressOf(database, harness),
    setBackfillProgress: (harness, progress) => writeBackfillProgress(database, harness, progress),

    close() {
      if (!open) return
      open = false
      database.close()
    },
  }
}
