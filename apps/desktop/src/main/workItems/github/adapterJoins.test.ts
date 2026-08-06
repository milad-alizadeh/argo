import { describe, expect, it } from 'vitest'
import type { FakeRepository } from '../__fixtures__/fakeGitHub'
import { OPEN_ISSUE as open, readItems } from '../__fixtures__/gitHubPort'

// The two joins the port derives rather than stores: which node a Work Item plays in the
// hierarchy, and what each `blockedBy` edge is actually doing. Asserted through `read()` for
// the same reason as the rest of the port suite — the derivation is only real at the interface.

describe('hierarchy roles', () => {
  it('takes the role from the provider type where it declares one', async () => {
    // A childless PRD is a PRD. Reading hierarchy first is exactly what miscasts it as a Task.
    const [item] = await readItems({ issues: [{ ...open, type: { name: 'PRD' } }] })
    expect(item?.kind).toBe('prd')
    expect(item?.declaredType).toBe('PRD')
  })

  it('falls back to hierarchy where the provider declares no type', async () => {
    const backlog = await readItems({
      issues: [open, { ...open, id: 1002, number: 13, title: 'A leaf' }],
      subIssues: { 12: [13] },
    })
    expect(backlog.find((item) => item.reference === '#12')?.kind).toBe('prd')
    expect(backlog.find((item) => item.reference === '#13')?.kind).toBe('task')
  })

  it('keeps the provider type word beside the role rather than in place of it', async () => {
    const [item] = await readItems({ issues: [{ ...open, type: { name: 'Bug' } }] })
    expect(item?.kind).toBe('task')
    expect(item?.declaredType).toBe('Bug')
  })

  it('links a child to its parent and returns children in the author order', async () => {
    // The provider's sub-issue position is the only source of that order, and nothing
    // downstream carries a position field to recover it from — so the read must preserve it.
    const backlog = await readItems({
      issues: [
        open,
        { ...open, id: 1003, number: 20, title: 'Second' },
        { ...open, id: 1002, number: 19, title: 'First' },
      ],
      subIssues: { 12: [20, 19] },
    })
    expect(backlog.map((item) => item.reference)).toEqual(['#12', '#20', '#19'])
    expect(backlog[1]?.parentId).toBe('github:1001')
  })
})

describe('blockedBy, verified directly', () => {
  const blocked: FakeRepository = {
    issues: [
      open,
      { id: 2001, number: 30, title: 'Open blocker', state: 'open' },
      { id: 2002, number: 31, title: 'Finished', state: 'closed', state_reason: 'completed' },
      { id: 2003, number: 32, title: 'Cancelled', state: 'closed', state_reason: 'not_planned' },
    ],
    blockedBy: { 12: [30, 31, 32] },
  }

  it('reads each blocker state off the blocker itself', async () => {
    const [item] = await readItems(blocked)
    expect(item?.blockedBy).toEqual([
      { id: 'github:2001', reference: '#30', state: 'blocking' },
      { id: 'github:2002', reference: '#31', state: 'satisfied' },
      { id: 'github:2003', reference: '#32', state: 'ruled-out' },
    ])
  })

  it('distinguishes a ruled-out blocker from a satisfied one', async () => {
    // The provider's own summary counts both as resolved. Argo deliberately does not: a
    // cancelled blocker satisfies no edge and leaves its dependent stranded.
    const [item] = await readItems(blocked)
    const states = item?.blockedBy.map((blocker) => blocker.state) ?? []
    expect(new Set(states).size).toBe(3)
  })

  it('reads no edges at all where the provider carries no dependency data', async () => {
    // A plan without issue dependencies is a provider with no DAG, not an unreachable one:
    // the blocked filter no-ops rather than the whole backlog read failing.
    const backlog = await readItems({
      issues: [open],
      refuse: { fragment: 'blocked_by', status: 404, message: 'Not Found' },
    })
    expect(backlog[0]?.blockedBy).toEqual([])
  })
})
