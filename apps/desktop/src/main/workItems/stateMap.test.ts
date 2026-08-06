import { describe, expect, it } from 'vitest'
import { bucketFor, type ProviderState, seedStateMap } from './stateMap'

// The per-workspace state-map (#167): heuristic-seeded from the provider's own status
// categories, `in-review` resolved by name-match, customs collapsed to the nearest bucket. It
// ships with no editor, so the heuristic is the whole contract and is asserted directly.

// GitHub Issues, whose whole workflow is two words. Which KIND of closure a `closed` is comes
// from `state_reason` rather than from a second state word, so the adapter answers that and the
// map never sees two states sharing a name.
const bare: ProviderState[] = [
  { name: 'open', category: 'open' },
  { name: 'closed', category: 'completed' },
]

const full: ProviderState[] = [
  { name: 'Backlog', category: 'open' },
  { name: 'Todo', category: 'open' },
  { name: 'In Progress', category: 'started' },
  { name: 'In Review', category: 'started' },
  { name: 'Done', category: 'completed' },
  { name: 'Canceled', category: 'canceled' },
]

describe('seeding from status categories', () => {
  it('seeds the two terminal categories to distinct buckets', () => {
    const map = seedStateMap(full)
    expect(bucketFor(map, 'Done')).toBe('done')
    expect(bucketFor(map, 'Canceled')).toBe('closed')
  })

  it('seeds an open category to todo', () => {
    expect(bucketFor(seedStateMap(full), 'Backlog')).toBe('todo')
  })

  it('seeds a started category to in-progress', () => {
    expect(bucketFor(seedStateMap(full), 'In Progress')).toBe('in-progress')
  })

  it('resolves in-review by name-match, not by category', () => {
    // `In Review` and `In Progress` share the `started` category on every provider that has
    // one, so the category alone cannot tell them apart.
    expect(bucketFor(seedStateMap(full), 'In Review')).toBe('in-review')
  })

  it('matches a provider word regardless of its casing or padding', () => {
    expect(bucketFor(seedStateMap(full), '  in progress ')).toBe('in-progress')
  })
})

describe('declared degradation tiers', () => {
  it('declares a workflow carrying the middle states as full', () => {
    expect(seedStateMap(full).tier).toBe('full')
  })

  it('declares a bare tracker as bare', () => {
    expect(seedStateMap(bare).tier).toBe('bare')
  })

  it('keeps done and closed distinct on a bare tracker', () => {
    const map = seedStateMap(bare)
    expect(map.tier).toBe('bare')
    expect(bucketFor(map, 'closed')).toBe('done')
  })

  it('does not promote a tracker to full for an open state merely named for review', () => {
    // A `needs review` label-ish state in the OPEN category is still a not-started item; only
    // a workflow that actually carries a started stage earns the full five.
    const map = seedStateMap([
      { name: 'Needs review', category: 'open' },
      { name: 'closed', category: 'completed' },
    ])
    expect(map.tier).toBe('bare')
    expect(bucketFor(map, 'Needs review')).toBe('todo')
  })
})

describe('collapsing to the nearest bucket', () => {
  it('collapses a custom state with no category by its name', () => {
    const map = seedStateMap([
      { name: 'Cooking', category: null },
      { name: 'Shipped', category: null },
      { name: 'Wontfix', category: null },
      { name: 'Under review', category: null },
    ])
    expect(bucketFor(map, 'Shipped')).toBe('done')
    expect(bucketFor(map, 'Wontfix')).toBe('closed')
    expect(bucketFor(map, 'Under review')).toBe('in-review')
  })

  it('collapses a state it cannot place to todo rather than guessing a terminal one', () => {
    // Guessing wrong at either terminal bucket claims work finished or abandoned that is
    // neither, so the unplaceable state degrades to the quietest bucket.
    expect(bucketFor(seedStateMap([{ name: 'Cooking', category: null }]), 'Cooking')).toBe('todo')
  })

  it('collapses a word the seed never saw, so a state added later is still placed', () => {
    // The map is seeded once per workspace; a provider that grows a state afterwards must not
    // fall off the ranking entirely.
    expect(bucketFor(seedStateMap(bare), 'In Review')).toBe('in-review')
  })
})
