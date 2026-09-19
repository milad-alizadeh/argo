// Shared by `archive-index.vitest.ts` and `search-index.vitest.ts`: both prove a read resolves
// off the Session index alone, never falling back to `archive-window.ts`'s scan, so they share one
// harness rather than each growing its own near-identical copy.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect } from 'vitest'
import {
  createSessionArchiveStore,
  sessionArchivePath,
} from '@/domains/sessions/main/archive-store'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { openSessionIndex } from '@/domains/sessions/main/session-index/open-index'
import type { IndexedAdapter } from '@/domains/sessions/main/session-index/roster-fixtures'
import type { SessionSource } from '@/domains/sessions/main/session-source'
import { createInMemorySessionTicketLinkStore } from '@/domains/tickets/main/session-links'

// Counts every call to the underlying adapter's own scan, the one `archive-window.ts` falls back
// to growing: an indexed read that never calls it proves the index answered alone.
export function spiedSource(source: SessionSource) {
  let discoverCalls = 0
  const spied: SessionSource = {
    ...source,
    discoverSessions: (options) => {
      discoverCalls += 1
      return source.discoverSessions(options)
    },
  }
  return { spied, discoverCallCount: () => discoverCalls }
}

// Registers the file's teardown and returns a harness bound to it, so a caller need declare
// neither the cleanup array nor its `afterEach` — both are the same in every file that reads
// through the index.
export function createIndexedReadHarness() {
  const cleanUp: (() => Promise<void>)[] = []
  afterEach(async () => {
    for (const close of cleanUp.splice(0)) await close()
  })

  return {
    harness: async (adapter: IndexedAdapter) => {
      const root = await mkdtemp(path.join(os.tmpdir(), `argo-indexed-read-${adapter.cli}-`))
      cleanUp.push(() => rm(root, { recursive: true, force: true }))
      const userData = await mkdtemp(path.join(os.tmpdir(), `argo-indexed-store-${adapter.cli}-`))
      cleanUp.push(() => rm(userData, { recursive: true, force: true }))
      const index = openSessionIndex(path.join(root, 'sessions.db'))
      cleanUp.push(() => index.close())
      const archive = createSessionArchiveStore(sessionArchivePath(userData))
      const source = adapter.source(root, index)
      const { spied, discoverCallCount } = spiedSource(source)
      const reader = createSessionReader([spied], createInMemorySessionTicketLinkStore(), archive)
      return { root, archive, index, source, reader, discoverCallCount }
    },
  }
}

export async function finishBackfill(source: SessionSource) {
  let progress = await source.backfillTick?.(30)
  for (
    let batches = 0;
    progress !== undefined && !progress.complete && batches < 20;
    batches += 1
  ) {
    progress = await source.backfillTick?.(30)
  }
}

// The shape both Archive and search assert after a read: which ids came back, whether the reply
// called itself final, and that the index answered alone.
export function expectAnsweredByIndex(options: {
  page: { sessions: readonly { id: string }[]; historyComplete: boolean }
  expectedIds: string[]
  historyComplete: boolean
  discoverCallCount: () => number
  before: number
}) {
  const { page, expectedIds, historyComplete, discoverCallCount, before } = options
  expect(page.sessions.map((row) => row.id)).toEqual(expectedIds)
  expect(page.historyComplete).toBe(historyComplete)
  expect(discoverCallCount()).toBe(before)
}
