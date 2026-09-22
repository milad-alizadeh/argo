// Background indexing over both real adapters (#2373): backfill covering older history in bounded
// batches, resuming after a restart from the boundary it persisted, and reconcile catching a
// change a watcher missed. Node runs these for the same reason `indexed-roster.vitest.ts` does:
// the Session index reaches `node:sqlite`, which Bun does not ship.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { createSessionReader } from '../../observation'
import { openSessionIndex } from './open-index'
import {
  type IndexedAdapter,
  indexedAdapters,
  manyTranscripts,
  sessionIdAt,
} from './roster-fixtures'

const cleanUp: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanUp.splice(0)) await close()
})

async function harness(adapter: IndexedAdapter) {
  const root = await mkdtemp(path.join(os.tmpdir(), `argo-backfill-${adapter.harness}-`))
  cleanUp.push(() => rm(root, { recursive: true, force: true }))
  const databasePath = path.join(root, 'sessions.db')
  function open() {
    const index = openSessionIndex(databasePath)
    cleanUp.push(() => index.close())
    return { index, source: adapter.source(root, index) }
  }
  return { root, open }
}

describe.each(indexedAdapters)(
  'backfill of $harness history through the Session index',
  (adapter) => {
    test('backfill covers every file older than the recent window, in bounded batches', async () => {
      const { root, open } = await harness(adapter)
      await adapter.write(root, manyTranscripts(120))
      const { source } = open()
      await source.discoverSessions() // warms the recent window (50 files)

      let progress = await source.backfillTick?.(30)
      for (
        let batches = 0;
        progress !== undefined && !progress.complete && batches < 10;
        batches += 1
      ) {
        progress = await source.backfillTick?.(30)
      }

      expect(progress?.complete).toBe(true)
      // Every file backfill walked is already indexed, so a window wide enough to cover the whole
      // tree parses nothing new: the recent window and backfill never leave a gap between them.
      const whole = await source.discoverSessions({ cursor: '120' })
      expect(whole.filesParsed).toBe(0)
      expect(whole.rows).toHaveLength(120)
      expect(whole.rows[0]?.id).toBe(sessionIdAt(0))
      expect(whole.rows.at(-1)?.id).toBe(sessionIdAt(119))
    })

    test('resumes backfill after a restart from the boundary it persisted, without re-parsing', async () => {
      const { root, open } = await harness(adapter)
      await adapter.write(root, manyTranscripts(90))
      const first = open()
      await first.source.discoverSessions()
      const firstBatch = await first.source.backfillTick?.(20)
      expect(firstBatch?.complete).toBe(false)

      // Reopening the index against the same file is what a restart looks like: a fresh instance,
      // holding nothing but what the last process wrote to disk.
      const resumed = open()
      const resumedProgress = await resumed.index.backfillProgress(adapter.harness)
      expect(resumedProgress).toEqual(firstBatch)

      let progress = resumedProgress
      for (let batches = 0; !progress.complete && batches < 10; batches += 1) {
        progress = (await resumed.source.backfillTick?.(20)) ?? progress
      }
      expect(progress.complete).toBe(true)

      const whole = await resumed.source.discoverSessions({ cursor: '90' })
      expect(whole.filesParsed).toBe(0)
      expect(whole.rows).toHaveLength(90)
    })
  },
)

describe.each(indexedAdapters)(
  'reconcile of $harness history through the Session index',
  (adapter) => {
    test('reconcile updates a file a watcher never announced', async () => {
      const { root, open } = await harness(adapter)
      await adapter.write(root, manyTranscripts(3))
      const { source } = open()
      await source.discoverSessions()

      const changed = sessionIdAt(1)
      await adapter.write(root, [
        { id: changed, prompt: 'Rewritten.', cwd: '/moved', at: '2026-09-13T18:00:00.000Z' },
      ])
      // No `discoverSessions` call between the write and the reconcile: nothing but reconcile itself
      // could have seen this change.
      const reconciled = await source.reconcileAll?.()
      expect(reconciled?.filesParsed).toBe(1)

      const after = await source.discoverSessions()
      const row = after.rows.find((candidate) => candidate.id === changed)
      expect({ title: row?.title?.text, cwd: row?.cwd }).toEqual({
        title: 'Rewritten.',
        cwd: '/moved',
      })
      // The window read above found the already-reconciled row unchanged.
      expect(after.filesParsed).toBe(0)
    })

    test('reports a Feed read active for its whole length, so background indexing knows to pause', async () => {
      const { root, open } = await harness(adapter)
      await adapter.write(root, manyTranscripts(1))
      const { source } = open()
      const reader = createSessionReader([source])

      expect(reader.isFeedReadActive()).toBe(false)
      const read = reader.readSessionFeed({
        version: 1,
        type: 'session.feed',
        requestId: 'feed-1',
        sessionId: sessionIdAt(0),
        subagentId: null,
        revision: null,
      })
      // The read's own `start` runs synchronously before its first await, so the flag is already up
      // by the time this call returns a pending promise.
      expect(reader.isFeedReadActive()).toBe(true)

      const reply = await read
      expect(reply.type).not.toBe('session.error')
      expect(reader.isFeedReadActive()).toBe(false)
    })
  },
)
