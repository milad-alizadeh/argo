import { describe, expect, it } from 'vitest'
import { type SessionFactsInput, sessionFacts } from './sessionFacts'
import { shipState } from './shipState'

// The state table of `docs/designs/cockpit-matrix.md`, one case per row: given the
// facts, the ribbon, its head, and the rail word are fully determined.

const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const

const row = (input: SessionFactsInput) => {
  const { ribbon, rail } = shipState(sessionFacts(input))
  return { model: ribbon, rail }
}

describe('S0 — clean tree, no commits', () => {
  it('grows no ribbon and stays Running', () => {
    const { model, rail } = row({})
    expect(model).toBeNull()
    expect(rail).toEqual({ word: 'Running', tone: 'run', icon: 'circle-notch' })
  })
})

describe('S1 — dirty 3 · agent working', () => {
  it('narrates Commits and stays Running', () => {
    const { model, rail } = row({ dirty: 3, agent: 'working' })
    expect(model).toEqual({
      nodes: { commits: 'now', pr: 'wait', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'commits',
      terminal: null,
    })
    expect(rail.word).toBe('Running')
  })
})

describe('S2 — dirty 3 · agent idle', () => {
  it('hands Commits back as a gate', () => {
    const { model, rail } = row({ dirty: 3, agent: 'idle', lifecycle: 'needs-input' })
    expect(model).toEqual({
      nodes: { commits: 'gate', pr: 'wait', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'commits',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'Commit ready', tone: 'amber', icon: 'git-commit' })
  })
})

describe('S3 — commits ✓ · no PR', () => {
  it('puts the head on the PR gate', () => {
    const { model, rail } = row({ headSha: HEAD, agent: 'idle', lifecycle: 'needs-input' })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'gate', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'pr',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'Create PR ready', tone: 'amber', icon: 'git-pull-request' })
  })
})

describe('S3b — S3 · create_pr: auto', () => {
  it('delegates the PR gate and narrates it', () => {
    const { model, rail } = row({ headSha: HEAD, policy: { createPr: 'auto' } })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'auto', ci: 'wait', review: 'wait', merge: 'wait' },
      head: 'pr',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'Opening PR · auto', tone: 'run', icon: 'gear' })
  })
})

describe('S4 — PR #42 · CI running', () => {
  it('moves the head to CI and points the rail at the PR', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'running', sha: HEAD },
    })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'done', ci: 'now', review: 'wait', merge: 'wait' },
      head: 'ci',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'PR #42 · CI', tone: 'run', icon: 'git-pull-request' })
  })
})

describe('S5 — CI failed', () => {
  it('fails the CI node and calls the rail out', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'failed', sha: HEAD },
    })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'done', ci: 'fail', review: 'wait', merge: 'wait' },
      head: 'ci',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'CI failing', tone: 'amber', icon: 'warning' })
  })
})

describe('S6 — CI ✓ · review round running', () => {
  it('moves the head to Review with no gate', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'running', sha: HEAD, findings: 0 }],
    })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'now', merge: 'wait' },
      head: 'review',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'In review', tone: 'run', icon: 'user' })
  })
})

describe('S7 — changes requested · 2 open', () => {
  it('marks Review changed and keeps the head there', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'changes', sha: HEAD, findings: 2 }],
    })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'warn', merge: 'wait' },
      head: 'review',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'Changes requested', tone: 'amber', icon: 'user' })
  })
})

describe('S8 — approved · all fresh', () => {
  it('opens the Merge gate', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
    })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'done', merge: 'gate' },
      head: 'merge',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'Ready to merge', tone: 'amber', icon: 'git-pull-request' })
  })
})

describe('S8b — S8 · merge: auto', () => {
  it('arms the Merge gate instead of asking', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: PR,
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
      policy: { merge: 'auto' },
    })
    expect(model).toEqual({
      nodes: { commits: 'done', pr: 'done', ci: 'done', review: 'done', merge: 'auto' },
      head: 'merge',
      terminal: null,
    })
    expect(rail).toEqual({ word: 'Auto-merge armed', tone: 'run', icon: 'gear' })
  })
})

describe('S9 — +1 commit while PR open', () => {
  it('syncs Commits, stales CI and Review, locks Merge', () => {
    const { model, rail } = row({
      headSha: HEAD,
      unpushed: 1,
      pr: PR,
      ci: { status: 'passed', sha: OLD },
      review: [{ by: '@sam', verdict: 'approved', sha: OLD, findings: 0 }],
    })
    expect(model).toEqual({
      nodes: { commits: 'sync', pr: 'done', ci: 'stale', review: 'stale', merge: 'lock' },
      head: 'commits',
      terminal: null,
    })
    expect(rail).toEqual({ word: '↑1 unpushed', tone: 'run', icon: 'arrow-line-up' })
  })
})

describe('S10 — merged', () => {
  it('replaces the ribbon with the merged terminal and lands the rail', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: { num: 38, state: 'merged', base: 'main' },
      ci: { status: 'passed', sha: HEAD },
      review: [{ by: '@sam', verdict: 'approved', sha: HEAD, findings: 0 }],
    })
    expect(model).toEqual({ nodes: null, head: null, terminal: 'merged' })
    expect(rail).toEqual({ word: 'Landed', tone: 'landed', icon: 'git-merge' })
  })
})

describe('S11 — closed w/o merge', () => {
  it('replaces the ribbon with the closed terminal', () => {
    const { model, rail } = row({
      headSha: HEAD,
      pr: { num: 35, state: 'closed', base: 'main' },
      ci: { status: 'passed', sha: HEAD },
    })
    expect(model).toEqual({ nodes: null, head: null, terminal: 'closed' })
    expect(rail).toEqual({ word: 'Closed', tone: 'stale', icon: 'prohibit' })
  })
})
