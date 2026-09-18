// The Roster served from the Session index, over both CLIs' real adapters (#2372). Node runs
// these rather than Bun, which ships no `node:sqlite`; `apps/desktop/AGENTS.md` says why. The
// warm-page budget over a large tree is `indexed-roster-budget.vitest.ts`.
import { afterEach, describe, expect, test } from 'vitest'
import { indexedAdapters, manyTranscripts, sessionIdAt } from './roster-fixtures'
import { rosterHarness } from './roster-harness'

const rosters = rosterHarness()
afterEach(rosters.cleanUp)

describe.each(indexedAdapters)('the $cli Roster read through the Session index', (adapter) => {
  test('opens no transcript file on a second read of an unchanged window', async () => {
    const { root, list } = await rosters.listing(adapter)
    await adapter.write(root, manyTranscripts(3))

    const cold = await list()
    const warm = await list()

    expect(cold.filesParsed).toBe(3)
    expect(warm.filesParsed).toBe(0)
    expect(warm.sessions.map((session) => session.id)).toEqual(
      cold.sessions.map((session) => session.id),
    )
  })

  test('indexes only the bounded recent window and returns it, newest first', async () => {
    const { root, list } = await rosters.listing(adapter)
    await adapter.write(root, manyTranscripts(60))

    const page = await list()

    expect({ found: page.filesFound, parsed: page.filesParsed }).toEqual({ found: 60, parsed: 50 })
    expect(page.sessions.map((session) => session.id).slice(0, 3)).toEqual([
      sessionIdAt(0),
      sessionIdAt(1),
      sessionIdAt(2),
    ])
    expect(page.nextCursor).not.toBeNull()
  })

  test('follows a changed transcript to its new title, timestamp and Project scope', async () => {
    const { root, list } = await rosters.listing(adapter)
    await adapter.write(root, manyTranscripts(3))
    await list()

    const moved = sessionIdAt(2)
    await adapter.write(root, [
      { id: moved, prompt: 'Rewritten.', cwd: '/moved', at: '2026-09-13T18:00:00.000Z' },
    ])
    const after = await list()

    const changed = after.sessions.find((session) => session.id === moved)
    expect({
      title: changed?.title?.text,
      updatedAt: changed?.updatedAt,
      cwd: changed?.cwd,
      cli: changed?.cli,
    }).toEqual({
      title: 'Rewritten.',
      updatedAt: '2026-09-13T18:00:00.000Z',
      cwd: '/moved',
      cli: adapter.cli,
    })
    expect(after.sessions[0]?.id).toBe(moved)
    expect(after.filesParsed).toBe(1)
  })
})
