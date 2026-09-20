import { rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import {
  SESSION_INDEX_SCHEMA,
  SESSION_INDEX_VERSION,
} from '@/domains/sessions/main/session-index/schema'
import {
  backfillProgressOf,
  writeBackfillProgress,
} from '@/domains/sessions/main/session-index/store-backfill'
import { searchChainsOf } from '@/domains/sessions/main/session-index/store-search'
import { writePass } from '@/domains/sessions/main/session-index/store-write'
import { storedRosterRow } from '@/domains/sessions/main/session-index/stored-row'
import {
  type BackfillProgress,
  type IndexedTranscriptFile,
  NO_CHAIN,
  type SessionIndexWrite,
} from '@/harnesses/session/session-index-contract'

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
