import { describe, expect, it } from 'vitest'
import { RIBBON_KEYS, ribbonModel } from './ribbonModel'
import { type SessionFactsInput, sessionFacts } from './sessionFacts'

// The ribbon rules of `docs/designs/cockpit-matrix.md` that the S-row table alone
// cannot pin down.

const HEAD = 'a1b2c3d'
const OLD = '9f0e1d2'
const PR = { num: 42, state: 'open', base: 'main' } as const
const approved = (sha: string) => [{ by: '@sam', verdict: 'approved' as const, sha, findings: 0 }]

const model = (input: SessionFactsInput) => ribbonModel(sessionFacts(input))

const shipped = (input: SessionFactsInput = {}) =>
  model({
    headSha: HEAD,
    pr: PR,
    ci: { status: 'passed', sha: HEAD },
    review: approved(HEAD),
    ...input,
  })

describe('R1 · head', () => {
  it('is the leftmost node that is not done-fresh', () => {
    const ribbon = shipped({ ci: { status: 'failed', sha: HEAD } })
    expect(ribbon?.head).toBe('ci')
  })

  it('never leaves a done node holding the head', () => {
    const ribbon = shipped({ review: [{ by: '@sam', verdict: 'changes', sha: HEAD, findings: 2 }] })
    const head = ribbon?.head
    if (!head || !ribbon?.nodes) throw new Error('expected a five-node ribbon')
    for (const key of RIBBON_KEYS.slice(0, RIBBON_KEYS.indexOf(head))) {
      expect(ribbon.nodes[key]).toBe('done')
    }
    expect(ribbon.nodes[head]).not.toBe('done')
  })

  it('treats a stale node as non-fresh and gives it the head', () => {
    const ribbon = shipped({ ci: { status: 'passed', sha: OLD } })
    expect(ribbon?.nodes?.ci).toBe('stale')
    expect(ribbon?.head).toBe('ci')
  })

  it('rests on Merge once every node is done', () => {
    expect(shipped({ policy: { merge: 'auto' } })?.head).toBe('merge')
  })
})

describe('R3 · staleness', () => {
  it('stales CI when its sha is behind the head', () => {
    expect(shipped({ ci: { status: 'passed', sha: OLD } })?.nodes?.ci).toBe('stale')
  })

  it('stales a failed CI run from an older sha too — nothing failed on this sha', () => {
    expect(shipped({ ci: { status: 'failed', sha: OLD } })?.nodes?.ci).toBe('stale')
  })

  it('stales an approval given on an older sha', () => {
    expect(shipped({ review: approved(OLD) })?.nodes?.review).toBe('stale')
  })

  it('locks Merge behind stale CI', () => {
    expect(shipped({ ci: { status: 'passed', sha: OLD } })?.nodes?.merge).toBe('lock')
  })

  it('locks Merge behind a stale approval', () => {
    expect(shipped({ review: approved(OLD) })?.nodes?.merge).toBe('lock')
  })

  it('locks Merge even when the gate is delegated', () => {
    expect(shipped({ review: approved(OLD), policy: { merge: 'auto' } })?.nodes?.merge).toBe('lock')
  })

  it('opens Merge only when CI and Review are both done and fresh', () => {
    expect(shipped()?.nodes?.merge).toBe('gate')
    expect(shipped({ ci: { status: 'running', sha: HEAD } })?.nodes?.merge).toBe('wait')
  })
})

describe('R5 · post-PR sync', () => {
  it('syncs Commits when a PR exists and commits are unpushed', () => {
    const ribbon = shipped({ unpushed: 2 })
    expect(ribbon?.nodes?.commits).toBe('sync')
    expect(ribbon?.head).toBe('commits')
  })

  it('narrates the sync as a standing order when push_after_pr is auto', () => {
    expect(shipped({ unpushed: 2, policy: { pushAfterPr: 'auto' } })?.nodes?.commits).toBe('auto')
  })

  it('grows no sync affordance before a PR exists (R4)', () => {
    expect(model({ headSha: HEAD, unpushed: 2 })?.nodes?.commits).toBe('done')
  })

  it('lets uncommitted work outrank the sync', () => {
    expect(shipped({ unpushed: 2, dirty: 1, agent: 'idle' })?.nodes?.commits).toBe('gate')
  })
})

describe('R7 · ribbon existence', () => {
  it('grows no ribbon while the tree equals its base', () => {
    expect(model({})).toBeNull()
  })

  it('grows one as soon as the tree is dirty', () => {
    expect(model({ dirty: 1 })).not.toBeNull()
  })

  it('grows one as soon as the branch carries a commit', () => {
    expect(model({ headSha: HEAD })).not.toBeNull()
  })
})

describe('R8 · terminal states', () => {
  it('replaces the nodes with a merged terminal', () => {
    expect(shipped({ pr: { num: 42, state: 'merged', base: 'main' } })).toEqual({
      nodes: null,
      head: null,
      terminal: 'merged',
    })
  })

  it('replaces the nodes with a closed terminal', () => {
    expect(shipped({ pr: { num: 42, state: 'closed', base: 'main' } })).toEqual({
      nodes: null,
      head: null,
      terminal: 'closed',
    })
  })

  it('outranks live facts — a dirty tree under a merged PR is still terminal', () => {
    const ribbon = shipped({ pr: { num: 42, state: 'merged', base: 'main' }, dirty: 4 })
    expect(ribbon?.terminal).toBe('merged')
  })
})
