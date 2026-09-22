// One adapter reading one temporary tree through its own index, with the Roster request the
// cockpit sends. `cleanUp` belongs in the calling suite's `afterEach`.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import type { SessionIndex } from './contract'
import { openSessionIndex } from './open-index'
import type { IndexedAdapter } from './roster-fixtures'

type Reader = ReturnType<typeof createSessionReader>

function listingOf(root: string, reader: Reader) {
  let request = 0
  const read = () => {
    request += 1
    return reader.listSessions({
      version: 1,
      type: 'session.list',
      requestId: `list-${request}`,
      projectRoot: null,
    })
  }
  return {
    root,
    reader,
    read,
    list: async () => {
      const reply = await read()
      if (reply.type !== 'session.listed')
        throw new Error(`Expected sessions, received ${reply.type}.`)
      return reply
    },
  }
}

export function rosterHarness() {
  const opened: (() => Promise<void>)[] = []

  // A reader over an existing tree, holding its own connection to the index that tree already has.
  // Called a second time for the same root, this is what a restart looks like.
  function readerAt(adapter: IndexedAdapter, root: string) {
    const databasePath = path.join(root, 'sessions.db')
    const index = openSessionIndex(databasePath)
    opened.push(() => index.close())
    return {
      ...listingOf(root, createSessionReader([adapter.source(root, index)])),
      databasePath,
      close: () => index.close(),
    }
  }

  return {
    cleanUp: async () => {
      for (const close of opened.splice(0)) await close()
    },
    reopen: async (adapter: IndexedAdapter, root: string) => readerAt(adapter, root),
    listing: async (adapter: IndexedAdapter) => {
      const root = await mkdtemp(path.join(os.tmpdir(), `argo-indexed-${adapter.harness}-`))
      opened.push(() => rm(root, { recursive: true, force: true }))
      return readerAt(adapter, root)
    },
    listingWith: async (
      adapter: IndexedAdapter,
      indexFor: (databasePath: string) => SessionIndex,
    ) => {
      const root = await mkdtemp(path.join(os.tmpdir(), `argo-indexed-${adapter.harness}-`))
      opened.push(() => rm(root, { recursive: true, force: true }))
      const databasePath = path.join(root, 'sessions.db')
      const index = indexFor(databasePath)
      opened.push(() => index.close())
      return {
        ...listingOf(root, createSessionReader([adapter.source(root, index)])),
        databasePath,
      }
    },
  }
}
