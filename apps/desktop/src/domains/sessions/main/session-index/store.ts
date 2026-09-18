import { rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { SessionRosterRow } from '../../contract/models'
import type { BackfillProgress, IndexedTranscriptFile, SessionIndexWrite } from './contract'
import { SESSION_INDEX_SCHEMA, SESSION_INDEX_VERSION } from './schema'
import { backfillProgressOf, writeBackfillProgress } from './store-backfill'
import { searchChainsOf } from './store-search'
import { writePass } from './store-write'
import { storedRosterRow } from './stored-row'

export type SessionIndexStore = {
  filesAt: (cli: string, paths: readonly string[]) => IndexedTranscriptFile[]
  filesOfChains: (cli: string, chainIds: readonly string[]) => IndexedTranscriptFile[]
  rowsOfChains: (cli: string, chainIds: readonly string[]) => SessionRosterRow[]
  searchChains: (cli: string, query: string) => SessionRosterRow[]
  chainLinks: (cli: string) => { sessionId: string; parentSessionId: string | null }[]
  strandedChains: (cli: string) => string[]
  write: (cli: string, pass: SessionIndexWrite) => void
  backfillProgress: (cli: string) => BackfillProgress
  setBackfillProgress: (cli: string, progress: BackfillProgress) => void
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
  function filesBy(column: 'path' | 'chain_id', cli: string, values: readonly string[]) {
    if (values.length === 0) return []
    const qualifiedColumn = { path: 'file.path', chain_id: 'file.chain_id' }[column]
    const rows = database
      .prepare(
        `SELECT file.path, file.session_id, file.written_at, file.size, file.chain_id,
                chain.row_json
         FROM transcript_file AS file
         LEFT JOIN session_chain AS chain
           ON chain.cli = file.cli AND chain.chain_id = file.chain_id
         WHERE file.cli = ? AND ${qualifiedColumn} IN (${placeholders(values.length)})`,
      )
      .all(cli, ...values) as FileRecord[]
    return rows.flatMap((record) => {
      return storedRosterRow(record.row_json) === null ? [] : [indexedFile(record)]
    })
  }
  return {
    filesAt: (cli, paths) => filesBy('path', cli, paths),
    filesOfChains: (cli, chainIds) => filesBy('chain_id', cli, chainIds),
    rowsOfChains(cli, chainIds) {
      if (chainIds.length === 0) return []
      const records = database
        .prepare(
          `SELECT row_json FROM session_chain
           WHERE cli = ? AND chain_id IN (${placeholders(chainIds.length)})
           ORDER BY updated_at DESC`,
        )
        .all(cli, ...chainIds) as { row_json: string }[]
      return records.flatMap((record) => {
        const row = storedRosterRow(record.row_json)
        return row === null ? [] : [row]
      })
    },
    searchChains: (cli, query) => searchChainsOf(database, cli, query),
    strandedChains(cli) {
      const records = database
        .prepare('SELECT chain_id FROM session_chain WHERE cli = ? AND origin_unread = 1')
        .all(cli) as { chain_id: string }[]
      return records.map((record) => record.chain_id)
    },
    chainLinks(cli) {
      const records = database
        .prepare('SELECT session_id, parent_session_id FROM chain_link WHERE cli = ?')
        .all(cli) as { session_id: string; parent_session_id: string | null }[]
      return records.map((record) => ({
        sessionId: record.session_id,
        parentSessionId: record.parent_session_id,
      }))
    },
    write: (cli, pass) => writePass(database, cli, pass),

    backfillProgress: (cli) => backfillProgressOf(database, cli),
    setBackfillProgress: (cli, progress) => writeBackfillProgress(database, cli, progress),

    close() {
      if (!open) return
      open = false
      database.close()
    },
  }
}
