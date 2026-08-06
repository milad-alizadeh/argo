import type { WorkflowTier, WorkItemBucket } from '../../shared'

// The per-workspace state-map (#167): the translation between the provider's own status words
// and Argo's canonical five. It ships HEURISTIC-SEEDED with no editor, so the heuristic below is
// the whole of the contract — an editor earns a ticket only if this proves wrong often enough.
//
// Seeding reads the provider's status CATEGORY first, because that is the one field a provider
// declares rather than a user types. Two things the category cannot answer are answered by name:
// `in-review` (which shares the started category with `in-progress` everywhere it exists), and a
// custom state carrying no category at all.

/** The provider-declared grouping behind a status word, normalized. `null` where the provider
 * declares none — a custom state a user typed, which only its name can place. */
export type StateCategory = 'open' | 'started' | 'completed' | 'canceled'

export interface ProviderState {
  /** The word verbatim, exactly as the provider spells it. */
  name: string
  category: StateCategory | null
}

export interface StateMap {
  tier: WorkflowTier
  /** Keyed by the normalized word, because a provider's casing is presentation and two states
   * never differ by it alone. */
  buckets: Record<string, WorkItemBucket>
}

const NAME_RULES: Array<[RegExp, WorkItemBucket]> = [
  [/review/i, 'in-review'],
  [/progress|doing|active|started|wip/i, 'in-progress'],
  [/done|complete|shipped|resolved|fixed/i, 'done'],
  [/cancel|abandon|wont|not planned|duplicate|invalid|stale/i, 'closed'],
]

export function seedStateMap(states: ProviderState[]): StateMap {
  const buckets: Record<string, WorkItemBucket> = {}
  for (const state of states) buckets[normalize(state.name)] = seedBucket(state)
  const middle = Object.values(buckets).some(
    (bucket) => bucket === 'in-progress' || bucket === 'in-review',
  )
  return { tier: middle ? 'full' : 'bare', buckets }
}

/**
 * Which bucket a provider's word ranks in. A word the seed never saw is collapsed by name
 * rather than dropped: the map is seeded once per workspace and a provider that grows a state
 * afterwards must still be placed somewhere.
 */
export function bucketFor(map: StateMap, word: string): WorkItemBucket {
  return map.buckets[normalize(word)] ?? collapse(word)
}

// The two terminal categories are taken at their word — they are the whole reason `done` and
// `closed` stay distinct, and no name-match could improve on the provider's own declaration.
// The middle is where the name gets a say, because `In Review` and `In Progress` are one
// category on every provider that carries either.
function seedBucket(state: ProviderState): WorkItemBucket {
  if (state.category === 'completed') return 'done'
  if (state.category === 'canceled') return 'closed'
  if (state.category === 'started') return /review/i.test(state.name) ? 'in-review' : 'in-progress'
  if (state.category === 'open') return 'todo'
  return collapse(state.name)
}

// A state Argo cannot place lands in `todo`, never in a terminal bucket: guessing `done` or
// `closed` claims work finished or abandoned that is neither, and the quiet bucket is the
// degrade-down answer.
function collapse(word: string): WorkItemBucket {
  return NAME_RULES.find(([pattern]) => pattern.test(word))?.[1] ?? 'todo'
}

function normalize(word: string): string {
  return word.trim().toLowerCase()
}
