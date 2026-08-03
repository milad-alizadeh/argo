// The rail's status vocabulary, derived from `docs/designs/cockpit-status-vocabulary.md`: the tones
// and glows a dot may take, the words the registry allows, the rail's own state names, and the ONE
// table binding each state to the dot it draws. State is carried by the DOT; the word stays neutral,
// so nothing here is a colour on a word. A tone is a name equal to its `--tone-*` token and a View
// interpolates `text-tone-${tone}` directly, no map.

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

/**
 * The delivery words the rail may claim over session status, every one the registry's own spelling.
 *
 * `blocked` and `landed` are its Merge states. `CI running` / `CI failed` are node-prefixed because
 * the registry's Roster note writes that form itself — "a row mid-delivery shows the delivery word
 * (e.g. `CI failed`)" — so they are not the bare CI words waiting to be "fixed" back. `PR #42` is
 * the PR anchor `PR #42 → main` with the base dropped: a 296px rail has no room for it and the
 * session header already carries it.
 */
export type DeliveryClaim = 'blocked' | 'CI failed' | 'CI running' | `PR #${number}` | 'landed'

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
  /** Whether the dot breathes. Motion means something is still moving — a session at work, a
   * delivery in flight, or a question waiting on your answer. Everything that has come to rest
   * holds still: idle, failed, landed, and a session Argo merely observes. So motion in the rail
   * always means something is moving, never merely that something is wrong. */
  pulse: boolean
  /** The one state asking for you, which the row answers with the attention sweep. */
  attention: boolean
}

export interface RailStatus {
  word: RosterWord
  dot: SessionDot
}

/** The rail's own state names — the alphabet the priority pick works in. Deliberately NOT the
 * words: styling is decided by the state a row is in, never by comparing rendered text. */
export type RailState =
  | 'needs-you'
  | 'blocked'
  | 'failed'
  | 'ci-failed'
  | 'ci-running'
  | 'pr-open'
  | 'landed'
  | 'running'
  | 'idle'
  | 'read-only'

/** One state the pick may choose, carrying the word that state spells for this row. The two travel
 * together, which is what makes the word and the dot unable to disagree. */
export interface Candidate {
  state: RailState
  word: RosterWord
}

const ASKING: SessionDot = {
  tone: 'amber',
  hollow: false,
  glow: 'live',
  pulse: true,
  attention: true,
}

// A failure burns as bright as `needs you` (registry, Session status: both are "come here" signals,
// hue-distinct) but it does NOT breathe. A failed check has already stopped: nothing more will
// happen until you act, and pulsing it would spend the eye on a state that is only waiting.
const BROKEN: SessionDot = {
  tone: 'red',
  hollow: false,
  glow: 'live',
  pulse: false,
  attention: false,
}

const MOVING: SessionDot = {
  tone: 'run',
  hollow: false,
  glow: 'live',
  pulse: true,
  attention: false,
}

const RESTING: SessionDot = {
  tone: 'gray',
  hollow: false,
  glow: 'quiet',
  pulse: false,
  attention: false,
}

const LANDED: SessionDot = {
  tone: 'landed',
  hollow: false,
  glow: 'quiet',
  pulse: false,
  attention: false,
}

const OBSERVED: SessionDot = {
  tone: 'gray',
  hollow: true,
  glow: 'faint',
  pulse: false,
  attention: false,
}

/**
 * Every rail state's dot, TOTAL over the alphabet — which is what makes a row physically unable to
 * say `CI failed` beside a green dot: the pick chooses a state and both the word and the dot are
 * read off that one choice.
 *
 * The needs-input states share the attention dot, so the gold sweep follows attention wherever it
 * comes from — a blocked delivery asks for you exactly as a permission prompt does.
 */
export const RAIL_DOTS: Record<RailState, SessionDot> = {
  'needs-you': ASKING,
  blocked: ASKING,
  failed: BROKEN,
  'ci-failed': BROKEN,
  'ci-running': MOVING,
  'pr-open': MOVING,
  landed: LANDED,
  running: MOVING,
  idle: RESTING,
  'read-only': OBSERVED,
}

/** The priority order (`cockpit-spec.md` §4.1): attention needs-input → attention failure →
 * delivery milestone → liveness → kind. Order WITHIN a tier breaks the tie when two candidates
 * both hold, which is why the session's own `failed` still outranks a `CI failed` beside it.
 * The ticket's tier-2 `errored` is absent: no observed fact can produce it today, and inventing
 * one to reach a word would be a fabrication. It joins the tier when a fact exists. */
export const STATE_TIERS: readonly (readonly RailState[])[] = [
  ['needs-you', 'blocked'],
  ['failed', 'ci-failed'],
  ['ci-running', 'pr-open', 'landed'],
  ['running', 'idle'],
]
