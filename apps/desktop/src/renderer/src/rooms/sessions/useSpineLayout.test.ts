import { describe, expect, it } from 'vitest'
import {
  applyResize,
  applySnap,
  isConsoleExpanded,
  SPINE,
  type SpineLayout,
} from './useSpineLayout'

const base: SpineLayout = {
  roster: SPINE.roster.initial,
  activity: SPINE.activity.initial,
  console: SPINE.console.initial,
}

describe('applyResize', () => {
  it('stores the px on the named edge, leaving the others', () => {
    expect(applyResize(base, 'activity', 640)).toEqual({ ...base, activity: 640 })
  })

  it('resizes the roster edge without touching the console', () => {
    const next = applyResize(base, 'roster', 300)
    expect(next.roster).toBe(300)
    expect(next.console).toBe(base.console)
  })
})

describe('isConsoleExpanded', () => {
  it('reads a console at or above the tall preset as expanded', () => {
    expect(isConsoleExpanded(SPINE.console.expanded)).toBe(true)
    expect(isConsoleExpanded(450)).toBe(true)
  })

  it('reads a console below the tall preset as collapsed', () => {
    expect(isConsoleExpanded(SPINE.console.initial)).toBe(false)
    expect(isConsoleExpanded(SPINE.console.expanded - 1)).toBe(false)
  })
})

describe('applySnap', () => {
  it('snaps a short console up to the expanded preset', () => {
    expect(applySnap(base, true).console).toBe(SPINE.console.expanded)
  })

  it('grows on expand without shrinking a manually enlarged console', () => {
    expect(applySnap({ ...base, console: 450 }, true).console).toBe(450)
  })

  it('snaps the console back to the initial preset', () => {
    expect(applySnap({ ...base, console: 999 }, false).console).toBe(SPINE.console.initial)
  })
})
