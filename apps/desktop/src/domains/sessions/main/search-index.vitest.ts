// Search through the Session index's own title/id columns (#2375), rather than growing the
// bounded discovery window `archive-window.ts` falls back to. Node runs these for the same reason
// `archive-index.vitest.ts` does: the index reaches `node:sqlite`, which Bun does not ship.
import { describe, expect, test } from 'vitest'
import {
  createIndexedReadHarness,
  expectAnsweredByIndex,
  finishBackfill,
} from './indexed-read-test-harness'
import type { createSessionReader } from './reader'
import { requestSearch } from './search-request'
import { indexedAdapters, manyTranscripts, sessionIdAt } from './session-index/roster-fixtures'

const { harness } = createIndexedReadHarness()

async function search(
  reader: ReturnType<typeof createSessionReader>,
  query: string,
  options?: Parameters<typeof requestSearch>[2],
) {
  const reply = await requestSearch(reader, query, options)
  return reply.type === 'session.searched' ? reply : Promise.reject(new Error(reply.type))
}

describe.each(indexedAdapters)('the $cli search read through the Session index', (adapter) => {
  test('finds reader-visible Feed prose and returns its bounded excerpt', async () => {
    const { root, source, reader } = await harness(adapter)
    await adapter.write(root, [
      {
        id: sessionIdAt(1),
        prompt: 'Give this Session an ordinary title.',
        reply: 'The visible result is a café that serves saffron tea.',
        cwd: '/proj',
        at: '2026-09-13T12:00:00.000Z',
      },
    ])
    await source.discoverSessions()
    await finishBackfill(source)

    const page = await search(reader, '"saffron" café', { status: 'all' })

    expect(page.sessions).toHaveLength(1)
    expect(page.sessions[0]).toMatchObject({
      id: sessionIdAt(1),
      searchExcerpt: expect.stringContaining('saffron tea'),
    })
  })

  test('finds a Session outside the recent window by id, opening no transcript file', async () => {
    const { root, source, reader, discoverCallCount } = await harness(adapter)
    // 60 sessions puts id 55 outside the 50-file recent window `discoverSessions` bounds itself to.
    await adapter.write(root, manyTranscripts(60))
    await source.discoverSessions()
    await finishBackfill(source)

    const before = discoverCallCount()
    const page = await search(reader, sessionIdAt(55), { status: 'all' })

    expectAnsweredByIndex({
      page,
      expectedIds: [sessionIdAt(55)],
      historyComplete: true,
      discoverCallCount,
      before,
    })
  }, 20_000)

  test('reports history incomplete rather than falling back to a scan while backfill is still running', async () => {
    const { root, source, reader, discoverCallCount } = await harness(adapter)
    await adapter.write(root, manyTranscripts(60))
    await source.discoverSessions()

    const before = discoverCallCount()
    const page = await search(reader, sessionIdAt(2), { status: 'all' })

    expectAnsweredByIndex({
      page,
      expectedIds: [sessionIdAt(2)],
      historyComplete: false,
      discoverCallCount,
      before,
    })
  }, 20_000)

  test('answers no matches for a query nothing indexed holds, opening no transcript file', async () => {
    const { root, source, reader, discoverCallCount } = await harness(adapter)
    await adapter.write(root, manyTranscripts(5))
    await source.discoverSessions()
    await finishBackfill(source)

    const before = discoverCallCount()
    const page = await search(reader, 'nothing-indexed-holds-this', { status: 'all' })

    expect(page.sessions).toEqual([])
    expect(discoverCallCount()).toBe(before)
  })
})
