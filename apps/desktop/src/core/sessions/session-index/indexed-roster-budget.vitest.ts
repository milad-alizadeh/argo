// The warm active-Roster page over a large transcript tree (#2372). Separate from the behaviour
// proofs because it writes 4,000 fixtures per adapter and takes seconds rather than milliseconds.
import { afterEach, describe, expect, test } from 'vitest'
import { indexedAdapters, manyTranscripts } from './roster-fixtures'
import { rosterHarness } from './roster-harness'

const rosters = rosterHarness()
afterEach(rosters.cleanUp)

describe.each(indexedAdapters)('the $cli warm Roster page', (adapter) => {
  test('returns in under 100ms over 4,000 transcripts', async () => {
    const { root, list } = await rosters.listing(adapter)
    await adapter.write(root, manyTranscripts(4_000))
    await list()

    // Least of three: the budget is what the machine can do, and one scheduling stall on a
    // loaded CI runner is not evidence that it cannot (`the-machine-is-a-variable`).
    let best = Number.POSITIVE_INFINITY
    let warm = await list()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const startedAt = performance.now()
      warm = await list()
      best = Math.min(best, performance.now() - startedAt)
    }

    expect({ found: warm.filesFound, parsed: warm.filesParsed }).toEqual({
      found: 4_000,
      parsed: 0,
    })
    expect(best).toBeLessThan(100)
  }, 120_000)
})
