// The temporary databases and stored shapes the index's own tests build. Each test opens its own
// folder, so they pass alone and in any order.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { managedRow } from '@/domains/sessions/main/lifecycle/managed-row'
import type { IndexedSessionChain, IndexedTranscriptFile, SessionIndexWrite } from './contract'
import { createSessionIndexStore, type SessionIndexStore } from './store'

export function storeHarness() {
  const opened: SessionIndexStore[] = []
  const folders: string[] = []

  function reopen(databasePath: string) {
    const store = createSessionIndexStore(databasePath)
    opened.push(store)
    return store
  }

  return {
    reopen,
    folder: async () => {
      const folder = await mkdtemp(path.join(tmpdir(), 'argo-session-index-'))
      folders.push(folder)
      return folder
    },
    open: async function open(name = 'sessions.sqlite') {
      const folder = await mkdtemp(path.join(tmpdir(), 'argo-session-index-'))
      folders.push(folder)
      const databasePath = path.join(folder, name)
      return { store: reopen(databasePath), databasePath }
    },
    cleanUp: async () => {
      for (const store of opened.splice(0)) store.close()
      for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true })
    },
  }
}

export function rowFor(id: string, updatedAt: string, cwd = '/work/one'): SessionRosterRow {
  return {
    ...managedRow(id, {
      harness: 'claude',
      cwd,
      status: 'idle',
      setup: { model: null, effort: null, mode: null },
      compactionPercentage: null,
      compactionStartedAt: null,
      compactionTokens: null,
      handoffFailure: null,
      handoffStartedAt: null,
      prompt: `Prompt for ${id}.`,
      startedAt: updatedAt,
    }),
    posture: 'external',
    updatedAt,
  }
}

// A pass with everything a test did not name left empty, so one test says only what it is about.
export function passOf(pass: Partial<SessionIndexWrite>): SessionIndexWrite {
  return {
    files: [],
    chains: [],
    links: [],
    removedPaths: [],
    retiredChainIds: [],
    ...pass,
  }
}

export function chainOf(row: SessionRosterRow, originUnread = false): IndexedSessionChain {
  return { chainId: row.id, updatedAt: row.updatedAt, row, originUnread, searchText: '' }
}

// The one-chain write most tests start from: one projection, and by default the one file it was
// stitched out of.
export function writeChain(
  store: SessionIndexStore,
  row: SessionRosterRow,
  held: {
    files?: IndexedTranscriptFile[]
    links?: { sessionId: string; parentSessionId: string | null }[]
    originUnread?: boolean
  } = {},
) {
  store.write(
    'claude',
    passOf({
      files: held.files ?? [fileFor(row.id)],
      chains: [chainOf(row, held.originUnread ?? false)],
      links: held.links ?? [],
    }),
  )
}

export function fileFor(id: string, chainId = id): IndexedTranscriptFile {
  return { path: `/transcripts/${id}.jsonl`, sessionId: id, writtenAt: 10, size: 20, chainId }
}
