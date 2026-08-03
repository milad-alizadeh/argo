import {
  isSteerable,
  LIFECYCLE_KEYS,
  type LifecycleModel,
  type LifecycleNodeKey,
  type LifecycleNodeState,
  type PrFacts,
  type SessionFacts,
  type SessionPosture,
  type SessionStatus,
} from '@shared'
import {
  type Candidate,
  RAIL_DOTS,
  type RailState,
  type RailStatus,
  type RosterWord,
  type SessionWord,
  STATE_TIERS,
} from './railVocabulary'

// The rail's ONE word per row and the dot that goes with it. Both come out of a single pick over the
// state alphabet, so a row cannot report one state in text and another in colour.

// `stopped` and `ended` both fold to `failed` — settled by `cockpit-app-shell-spec.md`, Copy
// ("the same fold as the dot"), which is also why `ended`'s dot folds to red rather than keeping
// the registry table's dim grey.
// `permission` and `asking` both fold to `needs you`. That leg is DERIVED BY
// `cockpit-ui-inventory.md` AND STATED BY NO SETTLED SPEC — the weakest leg of this table.
const SESSION_CANDIDATES: Record<SessionStatus, { state: RailState; word: SessionWord }> = {
  running: { state: 'running', word: 'running' },
  idle: { state: 'idle', word: 'idle' },
  permission: { state: 'needs-you', word: 'needs you' },
  asking: { state: 'needs-you', word: 'needs you' },
  stopped: { state: 'failed', word: 'failed' },
  ended: { state: 'failed', word: 'failed' },
}

const OBSERVED: Candidate = { state: 'read-only', word: 'read-only' }

const LANDED: Candidate = { state: 'landed', word: 'landed' }

export function sessionStatusWord(
  facts: SessionFacts,
  posture: SessionPosture,
): SessionWord | null {
  return isSteerable(posture) ? SESSION_CANDIDATES[facts.status].word : null
}

type NodeReading = `${LifecycleNodeKey}:${LifecycleNodeState}`

// Keyed by node and state so the rail cannot re-rank the lifecycle's nodes behind its back. The
// ATTENTION claims are read across the WHOLE lifecycle rather than off its head node alone: a failed
// check is a failed check whichever node the lifecycle happens to call head, so a dirty working tree
// must not suppress it. `ci:stale` / `review:stale` are `blocked` — a check or an approval that no
// longer speaks for the head commit is exactly what locks the Merge node.
const ATTENTION_CLAIMS: Partial<Record<NodeReading, Candidate>> = {
  'ci:stale': { state: 'blocked', word: 'blocked' },
  'review:stale': { state: 'blocked', word: 'blocked' },
  'ci:fail': { state: 'ci-failed', word: 'CI failed' },
}

type MilestoneState = Extract<RailState, 'ci-running' | 'pr-open' | 'landed'>

// A MILESTONE stays head-scoped, unlike a failure: it genuinely is a claim about where the work has
// reached, so only the node holding the head is entitled to make it.
const MILESTONE_CLAIMS: Partial<Record<NodeReading, MilestoneState>> = {
  'ci:wait': 'pr-open',
  'ci:now': 'ci-running',
  'review:now': 'pr-open',
  'review:warn': 'pr-open',
  'merge:gate': 'pr-open',
  'merge:auto': 'pr-open',
}

function milestone(state: MilestoneState, pr: PrFacts | null): Candidate | null {
  switch (state) {
    case 'ci-running':
      return { state, word: 'CI running' }
    case 'landed':
      return LANDED
    // A milestone is head-scoped and every head that reaches one sits past the PR node, so `pr` is
    // always here; the guard belongs to the type rather than to a case that can happen.
    case 'pr-open':
      return pr === null ? null : { state, word: `PR #${pr.num}` }
  }
}

function claimsOf(facts: SessionFacts, model: LifecycleModel | null): Candidate[] {
  if (model === null) return []
  if (model.terminal !== null) return model.terminal === 'merged' ? [LANDED] : []
  const { nodes, head } = model
  const attention = LIFECYCLE_KEYS.map((key) => ATTENTION_CLAIMS[`${key}:${nodes[key]}`]).filter(
    (claim): claim is Candidate => claim !== undefined,
  )
  const reached = MILESTONE_CLAIMS[`${head}:${nodes[head]}`]
  const milestoneClaim = reached === undefined ? null : milestone(reached, facts.pr)
  return milestoneClaim === null ? attention : [...attention, milestoneClaim]
}

/** The word the lifecycle alone claims for a row, or `null` where it has nothing to say. */
export function deliveryClaimWord(
  facts: SessionFacts,
  model: LifecycleModel | null,
): RosterWord | null {
  return pick(claimsOf(facts, model))?.word ?? null
}

function pick(candidates: readonly Candidate[]): Candidate | null {
  for (const tier of STATE_TIERS) {
    for (const state of tier) {
      const won = candidates.find((candidate) => candidate.state === state)
      if (won !== undefined) return won
    }
  }
  return null
}

/**
 * The rail's whole status for one Session: its one word, and the dot derived from the same pick.
 *
 * A delivery claim beats session status (registry, Roster note), and the kind tier is the last
 * resort — only a row Argo merely observes, with nothing else to claim, reaches `read-only`.
 */
export function railStatus(
  facts: SessionFacts,
  posture: SessionPosture,
  lifecycle: LifecycleModel | null,
): RailStatus {
  const session = isSteerable(posture) ? [SESSION_CANDIDATES[facts.status]] : []
  const { state, word } = pick([...claimsOf(facts, lifecycle), ...session]) ?? OBSERVED
  return { word, dot: RAIL_DOTS[state] }
}
