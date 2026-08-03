import type {
  LifecycleModel,
  LifecycleNodeKey,
  LifecycleNodeState,
  SessionFacts,
  SessionPosture,
  SessionStatus,
} from '@shared'

// The rail's status vocabulary, derived from `docs/designs/cockpit-status-vocabulary.md`. State is
// carried by the DOT; the word stays neutral, so nothing here is a colour. A tone is a name equal
// to its `--tone-*` token and a View interpolates `text-tone-${tone}` directly, no map.

export const ROSTER_TONES = ['run', 'amber', 'done', 'gray', 'red', 'stale', 'landed'] as const

export type RosterTone = (typeof ROSTER_TONES)[number]

// The icon vocabulary the Delivery strip still draws from (`domains/delivery`). The rail itself
// renders no status icon: `dot · name · word` says each thing once.
export const ROSTER_ICONS = [
  'arrow-line-up',
  'check',
  'circle',
  'circle-notch',
  'gear',
  'git-commit',
  'git-merge',
  'git-pull-request',
  'prohibit',
  'user',
  'warning',
  'x',
] as const

export type RosterIcon = (typeof ROSTER_ICONS)[number]

/** The registry's four Session-status words. `null` is the external/orphaned row, which earns
 * identity but no state word. */
export type SessionWord = 'running' | 'idle' | 'needs you' | 'failed'

/** The five delivery milestones the rail may claim over session status (issue 267). */
export type DeliveryClaim = 'blocked' | 'CI failed' | 'CI running' | 'PR open' | 'merged'

/** `read-only` is the kind label for an external/orphaned row. It is the one rail word absent
 * from the registry, added by issue 267 — and it is a KIND, not a state, so the registry's
 * one-word-per-state rule is intact. */
export type RosterWord = SessionWord | DeliveryClaim | 'read-only'

/** How hard a dot's halo burns. Every state glows — the weight IS the state's liveness, so a
 * resting state stays lit without competing with a live one. */
export const DOT_GLOWS = ['live', 'quiet', 'faint'] as const

export type DotGlow = (typeof DOT_GLOWS)[number]

export interface SessionDot {
  tone: RosterTone
  /** A ring with no fill: the registry's rendering for a session Argo only observes. */
  hollow: boolean
  glow: DotGlow
  /** Whether the dot breathes. A session still in motion does — it is running, or it is asking
   * you something and waiting on the answer. Everything that has come to rest holds still: idle,
   * failed, and a session Argo merely observes. So motion in the rail always means something is
   * moving, never merely that something is wrong. */
  pulse: boolean
  /** The one state asking for you, which the row answers with the attention sweep. */
  attention: boolean
}

export interface RailStatus {
  word: RosterWord
  dot: SessionDot
}

// `stopped` and `ended` both fold to `failed` — settled by `cockpit-app-shell-spec.md`, Copy
// ("the same fold as the dot"), which is also why `ended`'s dot folds to red rather than keeping
// the registry table's dim grey.
// `permission` and `asking` both fold to `needs you`. That leg is DERIVED BY
// `cockpit-ui-inventory.md` AND STATED BY NO SETTLED SPEC — the weakest leg of this table.
const SESSION_WORDS: Record<SessionStatus, SessionWord> = {
  running: 'running',
  idle: 'idle',
  permission: 'needs you',
  asking: 'needs you',
  stopped: 'failed',
  ended: 'failed',
}

const SESSION_DOTS: Record<SessionWord, SessionDot> = {
  running: { tone: 'run', hollow: false, glow: 'live', pulse: true, attention: false },
  idle: { tone: 'gray', hollow: false, glow: 'quiet', pulse: false, attention: false },
  'needs you': { tone: 'amber', hollow: false, glow: 'live', pulse: true, attention: true },
  // A failure burns as bright as `needs you` (registry, Session status: both are "come here"
  // signals, hue-distinct) but it does NOT breathe. Motion is reserved for the states that are
  // still moving, and a failed session has already stopped: nothing more will happen to it until
  // you act. Pulsing it would spend the eye's attention on a state that is only waiting.
  failed: { tone: 'red', hollow: false, glow: 'live', pulse: false, attention: false },
}

const OBSERVED_DOT: SessionDot = {
  tone: 'gray',
  hollow: true,
  glow: 'faint',
  pulse: false,
  attention: false,
}

/** Whether Argo merely observes this Session, in which case its status degrades away rather
 * than being faked (registry, Session status: "identity, no state word"). `orphaned` renders as
 * an `external`-shaped row (`cockpit-ui-inventory.md`). */
function isObservedOnly(posture: SessionPosture): boolean {
  return posture !== 'managed'
}

export function sessionStatusWord(
  facts: SessionFacts,
  posture: SessionPosture,
): SessionWord | null {
  return isObservedOnly(posture) ? null : SESSION_WORDS[facts.status]
}

export function sessionDot(facts: SessionFacts, posture: SessionPosture): SessionDot {
  return isObservedOnly(posture) ? OBSERVED_DOT : SESSION_DOTS[SESSION_WORDS[facts.status]]
}

// Keyed by the head node and the state it is in, so the rail cannot re-rank the lifecycle's
// nodes behind its back. A pair absent from the table has no milestone to claim, which is where
// the Session's own word belongs. `ci:stale` / `review:stale` are `blocked`: a check or an
// approval that no longer speaks for the head commit is exactly what locks the Merge node.
const DELIVERY_CLAIMS: Partial<Record<`${LifecycleNodeKey}:${LifecycleNodeState}`, DeliveryClaim>> =
  {
    'ci:wait': 'PR open',
    'ci:now': 'CI running',
    'ci:fail': 'CI failed',
    'ci:stale': 'blocked',
    'review:now': 'PR open',
    'review:warn': 'PR open',
    'review:stale': 'blocked',
    'merge:gate': 'PR open',
    'merge:auto': 'PR open',
  }

export function deliveryClaimWord(model: LifecycleModel | null): DeliveryClaim | null {
  if (!model) return null
  if (model.terminal) return model.terminal === 'merged' ? 'merged' : null
  return DELIVERY_CLAIMS[`${model.head}:${model.nodes[model.head]}`] ?? null
}

// The priority pick (issue 267): attention/needs-input → attention/failure → delivery milestone →
// liveness → kind. A delivery claim beats session status (registry, Roster note).
// The ticket's tier-2 `errored` is absent: no observed fact can produce it today, and inventing
// one to reach a word would be a fabrication. It joins the table when a fact exists.
const WORD_TIERS: readonly (readonly RosterWord[])[] = [
  ['needs you', 'blocked'],
  ['failed', 'CI failed'],
  ['CI running', 'PR open', 'merged'],
  ['running', 'idle'],
]

export function rosterWord(
  facts: SessionFacts,
  posture: SessionPosture,
  lifecycle: LifecycleModel | null,
): RosterWord {
  const session = sessionStatusWord(facts, posture)
  const claim = deliveryClaimWord(lifecycle)
  for (const tier of WORD_TIERS) {
    const won = tier.find((word) => word === session || word === claim)
    if (won) return won
  }
  // Only an observed-only row reaches here: a managed row always has a liveness word.
  return 'read-only'
}
