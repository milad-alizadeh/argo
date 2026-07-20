import type { PrFacts, SessionFacts } from './sessionFacts'

// The ribbon's render state, derived from facts alone (cockpit-matrix.md R1/R3/R5/
// R7/R8). Every done-state is a fact about a sha — which is why it can go stale.

export const RIBBON_KEYS = ['commits', 'pr', 'ci', 'review', 'merge'] as const

export type RibbonNodeKey = (typeof RIBBON_KEYS)[number]

export type RibbonNodeState =
  | 'wait'
  | 'now'
  | 'gate'
  | 'sync'
  | 'auto'
  | 'done'
  | 'fail'
  | 'warn'
  | 'stale'
  | 'lock'

export type RibbonNodes = Record<RibbonNodeKey, RibbonNodeState>

export type TerminalState = 'merged' | 'closed'

export type RibbonModel =
  | { nodes: RibbonNodes; head: RibbonNodeKey; terminal: null }
  | { nodes: null; head: null; terminal: TerminalState }

function terminalOf(pr: PrFacts | null): TerminalState | null {
  if (!pr) return null
  switch (pr.state) {
    case 'merged':
      return 'merged'
    case 'closed':
      return 'closed'
    case 'open':
      return null
  }
}

function commitsState(facts: SessionFacts): RibbonNodeState {
  if (facts.dirty > 0) return facts.agent === 'working' ? 'now' : 'gate'
  // Pre-PR there is no push (R4), so unpushed commits only surface once a PR exists;
  // a delegated push is a standing order rather than a repair you click (R5, R6).
  if (facts.unpushed > 0 && facts.pr) {
    return facts.policy.pushAfterPr === 'auto' ? 'auto' : 'sync'
  }
  return 'done'
}

function prState(facts: SessionFacts, commits: RibbonNodeState): RibbonNodeState {
  if (facts.pr) return 'done'
  if (commits !== 'done') return 'wait'
  return facts.policy.createPr === 'auto' ? 'auto' : 'gate'
}

function ciState(facts: SessionFacts): RibbonNodeState {
  const { ci, pr, headSha } = facts
  if (!pr || !ci) return 'wait'
  if (ci.sha !== headSha) return 'stale'
  switch (ci.status) {
    case 'running':
      return 'now'
    case 'passed':
      return 'done'
    case 'failed':
      return 'fail'
  }
}

function reviewState(facts: SessionFacts, ci: RibbonNodeState): RibbonNodeState {
  if (!facts.pr) return 'wait'
  const round = facts.review.at(-1)
  if (!round) return ci === 'done' ? 'now' : 'wait'
  switch (round.verdict) {
    case 'running':
      return 'now'
    case 'changes':
      return 'warn'
    case 'approved':
      return round.sha === facts.headSha ? 'done' : 'stale'
  }
}

function mergeState(
  facts: SessionFacts,
  ci: RibbonNodeState,
  review: RibbonNodeState,
): RibbonNodeState {
  if (ci === 'stale' || review === 'stale') return 'lock'
  if (facts.policy.merge === 'auto') return 'auto'
  return ci === 'done' && review === 'done' ? 'gate' : 'wait'
}

// null = no ribbon at all (R7): nothing has been produced for this Session to ship.
export function ribbonModel(facts: SessionFacts): RibbonModel | null {
  const terminal = terminalOf(facts.pr)
  if (terminal) return { nodes: null, head: null, terminal }
  if (!facts.headSha && facts.dirty === 0) return null

  const commits = commitsState(facts)
  const pr = prState(facts, commits)
  const ci = ciState(facts)
  const review = reviewState(facts, ci)
  const nodes: RibbonNodes = {
    commits,
    pr,
    ci,
    review,
    merge: mergeState(facts, ci, review),
  }
  return {
    nodes,
    head: RIBBON_KEYS.find((key) => nodes[key] !== 'done') ?? 'merge',
    terminal: null,
  }
}
