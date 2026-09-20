import type { DatabaseSync } from 'node:sqlite'
import type { SessionIndexWrite } from '@/harnesses/session/session-index-contract'

export function writePass(database: DatabaseSync, harness: string, pass: SessionIndexWrite) {
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
