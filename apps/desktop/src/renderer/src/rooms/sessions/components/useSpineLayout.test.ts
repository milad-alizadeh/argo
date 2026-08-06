import { describe, expect, it } from 'vitest'
import { applyResize, applySnap, isDockExpanded, SPINE, type SpineLayout } from './useSpineLayout'

const base: SpineLayout = {
  roster: SPINE.roster.initial,
  activity: SPINE.activity.initial,
  dock: SPINE.dock.initial,
}

describe('applyResize', () => {
  it('stores the px on the named edge, leaving the others', () => {
    expect(applyResize(base, 'activity', 640)).toEqual({ ...base, activity: 640 })
  })

  it('resizes the roster edge without touching the Dock', () => {
    const next = applyResize(base, 'roster', 300)
    expect(next.roster).toBe(300)
    expect(next.dock).toBe(base.dock)
  })
})

describe('isDockExpanded', () => {
  it('reads a Dock at or above the tall preset as expanded', () => {
    expect(isDockExpanded(SPINE.dock.expanded)).toBe(true)
    expect(isDockExpanded(450)).toBe(true)
  })

  it('reads a Dock below the tall preset as collapsed', () => {
    expect(isDockExpanded(SPINE.dock.initial)).toBe(false)
    expect(isDockExpanded(SPINE.dock.expanded - 1)).toBe(false)
  })
})

describe('applySnap', () => {
  it('snaps a short Dock up to the expanded preset', () => {
    expect(applySnap(base, true).dock).toBe(SPINE.dock.expanded)
  })

  it('grows on expand without shrinking a manually enlarged Dock', () => {
    expect(applySnap({ ...base, dock: 450 }, true).dock).toBe(450)
  })

  it('snaps the Dock back to the initial preset', () => {
    expect(applySnap({ ...base, dock: 999 }, false).dock).toBe(SPINE.dock.initial)
  })
})
