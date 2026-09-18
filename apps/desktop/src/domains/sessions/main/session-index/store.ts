// The one place SQL is written. `node:sqlite` is synchronous, so this store is too, and
// `open-index.ts` is what the rest of the app holds instead (#2372). Electron 44.2.0 ships
// Node 24.20.0, whose `node:sqlite` is built with FTS5.
import { rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { type SessionRosterRow, sessionRosterRowSchema } from '@/domains/sessions/contract/models'
import type { BackfillProgress, IndexedTranscriptFile, SessionIndexWrite } from './contract'
import { SESSION_INDEX_SCHEMA, SESSION_INDEX_VERSION } from './schema'
import { backfillProgressOf, writeBackfillProgress } from './store-backfill'

export type SessionIndexStore = {
  filesAt: (cli: string, paths: readonly string[]) => IndexedTranscriptFile[]
  filesOfChains: (cli: string, chainIds: readonly string[]) => IndexedTranscriptFile[]
  rowsOfChains: (cli: string, chainIds: readonly string[]) => SessionRosterRow[]
  chainLinks: (cli: string) => { sessionId: string; parentSessionId: string | null }[]
  strandedChains: (cli: string) => string[]
  write: (cli: string, pass: SessionIndexWrite) => void
  backfillProgress: (cli: string) => BackfillProgress
  setBackfillProgress: (cli: string, progress: BackfillProgress) => void
  close: () => void
}

// SQLite has no array parameter, and the lists here are a bounded discovery window rather than
// user text, so the placeholders are generated and every value still travels as a binding.
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

// A damaged file fails on the first statement rather than at `new DatabaseSync`, so the probe is
// what proves the index is usable. Deleting and reopening is the whole recovery: the index holds
// no fact that the transcripts do not. A second failure is not a damaged file — an unwritable
// directory reaches here too — and it is thrown rather than retried.
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

function writePass(database: DatabaseSync, cli: string, pass: SessionIndexWrite) {
  const insertFile = database.prepare(
    `INSERT OR REPLACE INTO transcript_file (cli, path, session_id, written_at, size, chain_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  const insertChain = database.prepare(
    `INSERT OR REPLACE INTO session_chain (cli, chain_id, updated_at, origin_unread, row_json)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const dropChain = database.prepare('DELETE FROM session_chain WHERE cli = ? AND chain_id = ?')
  const insertLink = database.prepare(
    'INSERT OR REPLACE INTO chain_link (cli, session_id, parent_session_id) VALUES (?, ?, ?)',
  )
  const dropFile = database.prepare('DELETE FROM transcript_file WHERE cli = ? AND path = ?')
  const dropChainFiles = database.prepare(
    'DELETE FROM transcript_file WHERE cli = ? AND chain_id = ?',
  )
  database.exec('BEGIN')
  try {
    // A chain's files are replaced whole, so a re-stitch that moved a file into another chain
    // leaves no member behind claiming the old one.
    for (const chain of pass.chains) dropChainFiles.run(cli, chain.chainId)
    for (const path of pass.removedPaths) dropFile.run(cli, path)
    for (const chainId of pass.retiredChainIds) dropChain.run(cli, chainId)
    for (const file of pass.files)
      insertFile.run(cli, file.path, file.sessionId, file.writtenAt, file.size, file.chainId)
    for (const chain of pass.chains)
      insertChain.run(
        cli,
        chain.chainId,
        chain.updatedAt,
        chain.originUnread ? 1 : 0,
        JSON.stringify(chain.row),
      )
    for (const link of pass.links) insertLink.run(cli, link.sessionId, link.parentSessionId)
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

export function createSessionIndexStore(databasePath: string): SessionIndexStore {
  const database = openIndex(databasePath)
  // A window teardown and the process exit both close the index, so closing twice is a normal
  // path rather than a fault.
  let open = true

  function filesBy(column: 'path' | 'chain_id', cli: string, values: readonly string[]) {
    if (values.length === 0) return []
    const rows = database
      .prepare(
        `SELECT path, session_id, written_at, size, chain_id FROM transcript_file
         WHERE cli = ? AND ${column} IN (${placeholders(values.length)})`,
      )
      .all(cli, ...values) as FileRecord[]
    return rows.map(indexedFile)
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
      // A row the current schema cannot parse is a cache miss, never a row the Roster draws: the
      // caller finds the chain unanswered and rebuilds it from the transcripts.
      return records.flatMap((record) => {
        const parsed = sessionRosterRowSchema.safeParse(JSON.parse(record.row_json))
        return parsed.success ? [parsed.data] : []
      })
    },

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
