// The Session index as its callers hold it: asynchronous, whatever owns the connection beneath.
// #2371 recorded a worker thread for that owner, and this opens the store in the main process
// instead. The window a Roster pass reads is 50 rows, which is not what a worker is for; the scan
// that is — backfilling full history (#2373) — can move behind this same port without a caller
// changing, which is why the port is asynchronous already.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import { recoverableIndexOperation } from '@/domains/sessions/main/index/session-index/recovery'
import { createSessionIndexStore } from '@/domains/sessions/main/index/session-index/store'

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
    filesAt: async (harness, paths) =>
      recoverableIndexOperation(() => store.filesAt(harness, paths)),
    filesOfChains: async (harness, chainIds) =>
      recoverableIndexOperation(() => store.filesOfChains(harness, chainIds)),
    rowsOfChains: async (harness, chainIds) =>
      recoverableIndexOperation(() => store.rowsOfChains(harness, chainIds)),
    searchChains: async (harness, query) =>
      recoverableIndexOperation(() => store.searchChains(harness, query)),
    chainLinks: async (harness) => recoverableIndexOperation(() => store.chainLinks(harness)),
    strandedChains: async (harness) =>
      recoverableIndexOperation(() => store.strandedChains(harness)),
    write: async (harness, pass) => recoverableIndexOperation(() => store.write(harness, pass)),
    backfillProgress: async (harness) =>
      recoverableIndexOperation(() => store.backfillProgress(harness)),
    setBackfillProgress: async (harness, progress) =>
      recoverableIndexOperation(() => store.setBackfillProgress(harness, progress)),
    close: async () => store.close(),
  }
}
