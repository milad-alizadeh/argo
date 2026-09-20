// A resumed half indexed before its origin was on disk (#2372). The packaged Roster proof caught
// this: the index served the stranded half its own row and the origin a second one, so one Session
// read as two and the order moved under the reader.
import { afterEach, describe, expect, test } from 'vitest'
import { indexedAdapters, sessionIdAt } from '@/domains/sessions/main/session-index/roster-fixtures'
import { rosterHarness } from '@/domains/sessions/main/session-index/roster-harness'

const rosters = rosterHarness()
afterEach(rosters.cleanUp)

const origin = sessionIdAt(1)
const resumed = sessionIdAt(0)

describe.each(indexedAdapters)('the $harness index and a stranded resume', (adapter) => {
  test('joins a resumed half to the origin that arrives after it was indexed', async () => {
    const { root, list } = await rosters.listing(adapter)
    await adapter.write(root, [
      {
        id: resumed,
        prompt: 'Carried on.',
        cwd: '/proj',
        at: '2026-09-13T12:00:00.000Z',
        resumeOf: origin,
      },
    ])

    const stranded = await list()
    expect(stranded.sessions.map((session) => session.id)).toEqual([resumed])

    await adapter.write(root, [
      { id: origin, prompt: 'Started it.', cwd: '/proj', at: '2026-09-13T11:00:00.000Z' },
    ])
    const joined = await list()

    expect(joined.sessions.map((session) => session.id)).toEqual([origin])
    expect(joined.sessions[0]?.retiredIds).toEqual([resumed])
  })
})
