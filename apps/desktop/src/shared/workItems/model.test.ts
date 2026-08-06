import { describe, expect, it } from 'vitest'
import { workItemKind, workItemView } from './model'

// The one derivation the Work Item model owns outright: which role a node plays in the
// hierarchy, from the provider's declared type where it has one and from children otherwise.

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

describe('the view fixture', () => {
  it('defaults to the honest floor of a bare tracker', () => {
    const item = workItemView({ id: 'github:1' })
    expect(item.status).toEqual({ word: 'open', bucket: 'todo' })
    expect(item.kind).toBe('task')
    expect(item.declaredType).toBeNull()
  })

  it('defaults every fact the provider may not carry to unknown, not to a value', () => {
    const item = workItemView({ id: 'github:1' })
    expect(item.assignee).toBeNull()
    expect(item.priority).toBeNull()
  })
})
