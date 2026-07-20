import { describe, expect, it } from 'vitest'
import { LIFECYCLE_NODE_STATE } from './lifecycleNodeState'

describe('lifecycle node state vocabulary', () => {
  it('carries a strikethrough on stale — R3: a fact about an older sha, never a failure', () => {
    expect(LIFECYCLE_NODE_STATE.stale.label).toContain('line-through')
    expect(LIFECYCLE_NODE_STATE.stale.label).not.toContain('verdict-block')
  })

  it('gives now, gate and sync the identical glyph — R2 tells gate apart by form, not tint', () => {
    expect(LIFECYCLE_NODE_STATE.gate.glyph).toBe(LIFECYCLE_NODE_STATE.now.glyph)
    expect(LIFECYCLE_NODE_STATE.sync.glyph).toBe(LIFECYCLE_NODE_STATE.now.glyph)
  })

  it('reads fail and warn as distinct verdict tones', () => {
    expect(LIFECYCLE_NODE_STATE.fail.glyph).not.toBe(LIFECYCLE_NODE_STATE.warn.glyph)
    expect(LIFECYCLE_NODE_STATE.fail.Icon).not.toBe(LIFECYCLE_NODE_STATE.warn.Icon)
  })

  it('never lets a delegated (auto) node read as done', () => {
    expect(LIFECYCLE_NODE_STATE.auto.glyph).not.toBe(LIFECYCLE_NODE_STATE.done.glyph)
    expect(LIFECYCLE_NODE_STATE.auto.Icon).not.toBe(LIFECYCLE_NODE_STATE.done.Icon)
  })
})
