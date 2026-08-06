import { describe, expect, it } from 'vitest'
import { isStranded, workItemKind, workItemView } from './model'

// The two derivations the Work Item model owns outright: which role a node plays, and whether
// its blockers have left it somewhere no provider will ever move it out of.

describe('the hierarchy role', () => {
  it('takes a declared parent word as a PRD even with no children', () => {
    // The whole reason the provider's type outranks hierarchy: a PRD nobody has broken down
    // yet is still a PRD, and reading children first would file it as a Task.
    expect(workItemKind('PRD', false)).toBe('prd')
  })

  it('reads a declared leaf word as a task even with children', () => {
    expect(workItemKind('Bug', true)).toBe('task')
  })

  it('matches a declared word regardless of casing or padding', () => {
    expect(workItemKind('  Epic ', false)).toBe('prd')
  })

  it('falls back to children where the provider declares nothing', () => {
    expect(workItemKind(null, true)).toBe('prd')
    expect(workItemKind(null, false)).toBe('task')
  })

  it('trusts an unrecognised declared word as the leaf role it states', () => {
    // A provider that named a type has stated a role. Falling back to hierarchy here would
    // re-introduce the miscast for every custom type name.
    expect(workItemKind('Chore', true)).toBe('task')
  })
})

describe('stranded work', () => {
  const blocker = (state: 'blocking' | 'satisfied' | 'ruled-out' | 'unknown') => ({
    id: `github:${state}`,
    reference: '#1',
    state,
  })

  it('is stranded when every edge resolved but one of them was ruled out', () => {
    expect(isStranded([blocker('satisfied'), blocker('ruled-out')])).toBe(true)
  })

  it('is not stranded while something is still genuinely blocking', () => {
    expect(isStranded([blocker('ruled-out'), blocker('blocking')])).toBe(false)
  })

  it('is not stranded when an edge cannot be read', () => {
    // An unresolvable blocker blocks and reads `unknown`; calling that stranded would claim a
    // dead end Argo never established.
    expect(isStranded([blocker('ruled-out'), blocker('unknown')])).toBe(false)
  })

  it('is not stranded with nothing blocking it', () => {
    expect(isStranded([])).toBe(false)
    expect(isStranded([blocker('satisfied')])).toBe(false)
  })
})

describe('the view fixture', () => {
  it('defaults to the honest floor of a bare tracker', () => {
    const item = workItemView({ id: 'github:1' })
    expect(item.status).toEqual({ word: 'open', bucket: 'todo' })
    expect(item.kind).toBe('task')
    expect(item.declaredType).toBeNull()
  })
})
