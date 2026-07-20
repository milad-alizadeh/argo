// The ship-flow facts of one Session, per `docs/designs/cockpit-matrix.md`. Facts
// only: every rendered state is derived from these, never stored alongside them.

export type PrLifecycle = 'open' | 'merged' | 'closed'

export interface PrFacts {
  num: number
  state: PrLifecycle
  base: string
}

export type CiStatus = 'running' | 'passed' | 'failed'

export interface CiFacts {
  status: CiStatus
  sha: string
}

export type ReviewVerdict = 'running' | 'approved' | 'changes'

export interface ReviewRound {
  by: string
  verdict: ReviewVerdict
  sha: string
  findings: number
}

export type GatePolicy = 'ask' | 'auto'

export interface SessionPolicy {
  createPr: GatePolicy
  merge: GatePolicy
  pushAfterPr: 'manual' | 'auto'
}

export type SessionLifecycle = 'running' | 'needs-input' | 'done' | 'failed' | 'queued' | 'orphaned'

export interface SessionFacts {
  // The Session's own triage word, which the rail falls back to whenever the ribbon
  // has nothing to say (no ribbon at all, or a head node no rule speaks for).
  lifecycle: SessionLifecycle
  // Who owns the Commits stage right now: a working agent narrates it, an idle one
  // hands the repair back to you. Narrower than `lifecycle`, which grades the Session.
  agent: 'working' | 'idle'
  dirty: number
  unpushed: number
  // null = the branch carries no commits of its own (tree == base, R7).
  headSha: string | null
  pr: PrFacts | null
  ci: CiFacts | null
  review: ReviewRound[]
  policy: SessionPolicy
}

export type SessionFactsInput = Partial<Omit<SessionFacts, 'policy'>> & {
  policy?: Partial<SessionPolicy>
}

// Defaults are the matrix's own: an agent working on a clean tree that equals its
// base, every gate asked for — so a caller states only the facts its case is about.
export function sessionFacts(input: SessionFactsInput = {}): SessionFacts {
  const { policy, ...facts } = input
  return {
    lifecycle: 'running',
    agent: 'working',
    dirty: 0,
    unpushed: 0,
    headSha: null,
    pr: null,
    ci: null,
    review: [],
    ...facts,
    policy: { createPr: 'ask', merge: 'ask', pushAfterPr: 'manual', ...policy },
  }
}
