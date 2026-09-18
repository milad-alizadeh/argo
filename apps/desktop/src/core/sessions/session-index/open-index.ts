// The Session index as its callers hold it: asynchronous, whatever owns the connection beneath.
// #2371 recorded a worker thread for that owner, and this opens the store in the main process
// instead. The window a Roster pass reads is 50 rows, which is not what a worker is for; the scan
// that is — backfilling full history (#2373) — can move behind this same port without a caller
// changing, which is why the port is asynchronous already.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { SessionIndex } from './contract'
import { createSessionIndexStore } from './store'

// Everything here is rebuilt from the transcripts that remain the authoritative store, so it sits
// beside `portable-v1` rather than inside it: nothing in this directory is the user's to keep.
export function sessionIndexPath(userData: string): string {
  return path.join(userData, 'cache-v1', 'session-index.db')
}

// The index is a cache, so failing to open one is a slower Roster and never a window that does not
// appear: the reader runs without it and reads the transcripts, which is what it did before #2372.
export function openSessionIndexOrNone(databasePath: string): SessionIndex | undefined {
  try {
    return openSessionIndex(databasePath)
  } catch (error) {
    console.error('Session index unavailable, reading transcripts directly', error)
    return undefined
  }
}

export function openSessionIndex(databasePath: string): SessionIndex {
  mkdirSync(path.dirname(databasePath), { recursive: true })
  const store = createSessionIndexStore(databasePath)
  return {
    filesAt: async (cli, paths) => store.filesAt(cli, paths),
    filesOfChains: async (cli, chainIds) => store.filesOfChains(cli, chainIds),
    rowsOfChains: async (cli, chainIds) => store.rowsOfChains(cli, chainIds),
    chainLinks: async (cli) => store.chainLinks(cli),
    strandedChains: async (cli) => store.strandedChains(cli),
    write: async (cli, pass) => store.write(cli, pass),
    close: async () => store.close(),
  }
}
