// The Archive read and restore through the Session index's persisted resume graph (#2374), rather
// than growing the bounded discovery window `archive-window.ts` falls back to. Node runs these for
// the same reason `indexed-roster.vitest.ts` does: the index reaches `node:sqlite`, which Bun does
// not ship.
import { describe, expect, test } from 'vitest'
import {
  createIndexedReadHarness,
  expectAnsweredByIndex,
  finishBackfill,
} from '@/domains/sessions/main/index/indexed-read-test-harness'
import {
  indexedAdapters,
  manyTranscripts,
  sessionIdAt,
} from '@/domains/sessions/main/index/session-index/roster-fixtures'
import type { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { requestArchiveList } from './archive-list-request'

const { harness } = createIndexedReadHarness()

async function archiveList(
  reader: ReturnType<typeof createSessionReader>,
  options: { cursor?: string | null; restoreId?: string | null; requestId?: string } = {},
) {
  const reply = await requestArchiveList(reader, options)
  return reply.type === 'session.archive.listed' ? reply : Promise.reject(new Error(reply.type))
}

describe.each(indexedAdapters)('the $harness Archive read through the Session index', (adapter) => {
  test('resolves an archived Session outside the recent window, opening no transcript file', async () => {
    const { root, archive, source, reader, discoverCallCount } = await harness(adapter)
    // 60 sessions puts id 55 outside the 50-file recent window `discoverSessions` bounds itself to.
    await adapter.write(root, manyTranscripts(60))
    await source.discoverSessions()
    await finishBackfill(source)
    await archive.setArchived([sessionIdAt(55)], true)

    const before = discoverCallCount()
    const page = await archiveList(reader)

    expectAnsweredByIndex({
      page,
      expectedIds: [sessionIdAt(55)],
      historyComplete: true,
      discoverCallCount,
      before,
    })
  }, 20_000)

  test('reports history incomplete rather than falling back to a scan while backfill is still running', async () => {
    const { root, archive, source, reader, discoverCallCount } = await harness(adapter)
    await adapter.write(root, manyTranscripts(60))
    await source.discoverSessions()
    await archive.setArchived([sessionIdAt(2)], true)

    const before = discoverCallCount()
    const page = await archiveList(reader)

    // Id 2 sits inside the warmed window, so the index already answers for it, but backfill has not
    // walked the rest of the tree yet: the reply says so rather than presenting this page as final.
    expectAnsweredByIndex({
      page,
      expectedIds: [sessionIdAt(2)],
      historyComplete: false,
      discoverCallCount,
      before,
    })
  }, 20_000)
})

describe.each(indexedAdapters)(
  'the $harness Archive restore through the Session index',
  (adapter) => {
    test('restores a Session by a retired id resolved off the index, opening no transcript file', async () => {
      const { root, archive, source, reader, discoverCallCount } = await harness(adapter)
      await adapter.write(root, manyTranscripts(3))
      const rootId = sessionIdAt(2)
      // Codex names a rollout file after its Session's own uuid (`roster-fixtures.ts`'s
      // `codexFileName`): a non-uuid id here would fall through the adapter's own filename match and
      // never resolve to the id this test archives under.
      const resumedId = sessionIdAt(999)
      await adapter.write(root, [
        {
          id: resumedId,
          prompt: 'Resumed.',
          cwd: '/proj',
          at: '2026-09-13T18:00:00.000Z',
          resumeOf: rootId,
        },
      ])
      await source.discoverSessions()
      await finishBackfill(source)
      // Archived while the root id was still current, before the later resume retired it.
      await archive.setArchived([rootId], true)

      const before = discoverCallCount()
      const page = await archiveList(reader, { restoreId: resumedId })

      expect(page.restored?.id).toBe(rootId)
      expect(page.restored?.retiredIds).toContain(resumedId)
      expect(discoverCallCount()).toBe(before)
    })

    test('falls back to growing the window for a restore id backfill has not reached yet', async () => {
      const { root, archive, source, reader, discoverCallCount } = await harness(adapter)
      // A higher range than any earlier test in this file backfills, so the adapter's shared,
      // process-wide chain history (one per launch, by design) cannot already call it known.
      await adapter.write(root, manyTranscripts(120))
      await source.discoverSessions()
      // No backfill run: history stays incomplete, so an id outside the warmed window is not yet
      // provably absent from the index and restore must still grow the window to be correct.
      await archive.setArchived([sessionIdAt(115)], true)

      const before = discoverCallCount()
      const restored = await reader.archiveSet({
        version: 1,
        type: 'session.archive.set',
        requestId: 'archive-set-2',
        sessionIds: [sessionIdAt(115)],
        archived: false,
      })

      expect(restored.type).toBe('session.archive.applied')
      expect(discoverCallCount()).toBeGreaterThan(before)
    }, 20_000)

    test('archiveList falls back to growing the window for a restore id backfill has not reached yet', async () => {
      const { root, archive, source, reader, discoverCallCount } = await harness(adapter)
      // Same disjoint range as the archiveSet fallback test above, plus an offset so the two never
      // collide inside the shared, process-wide chain history.
      await adapter.write(root, manyTranscripts(240))
      await source.discoverSessions()
      // No backfill run: history stays incomplete, so a `restoreId` outside the warmed window is not
      // yet provably absent from the index and the list read must still grow the window to answer.
      await archive.setArchived([sessionIdAt(235)], true)

      const before = discoverCallCount()
      const page = await archiveList(reader, { restoreId: sessionIdAt(235) })

      expect(page.restored?.id).toBe(sessionIdAt(235))
      expect(discoverCallCount()).toBeGreaterThan(before)
    }, 20_000)
  },
)
