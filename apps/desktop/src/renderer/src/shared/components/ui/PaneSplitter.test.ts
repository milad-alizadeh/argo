import { describe, expect, it } from 'vitest'
import { clampPaneSize, keyStepDelta } from './PaneSplitter'

describe('clampPaneSize', () => {
  it('rounds a fractional pointer position to whole pixels', () => {
    expect(clampPaneSize(248.4, 190, 360)).toBe(248)
    expect(clampPaneSize(248.6, 190, 360)).toBe(249)
  })

  it('clamps a drag past either end to the bound it ran into', () => {
    expect(clampPaneSize(12, 190, 360)).toBe(190)
    expect(clampPaneSize(900, 190, 360)).toBe(360)
    expect(clampPaneSize(-40, 190, 360)).toBe(190)
  })

  it('leaves the bounds themselves alone', () => {
    expect(clampPaneSize(190, 190, 360)).toBe(190)
    expect(clampPaneSize(360, 190, 360)).toBe(360)
  })
})

describe('keyStepDelta', () => {
  it('steps a vertical splitter along its own axis', () => {
    expect(keyStepDelta('ArrowLeft', 'v')).toBe(-16)
    expect(keyStepDelta('ArrowRight', 'v')).toBe(16)
  })

  it('steps a horizontal splitter along its own axis', () => {
    expect(keyStepDelta('ArrowUp', 'h')).toBe(-16)
    expect(keyStepDelta('ArrowDown', 'h')).toBe(16)
  })

  it('ignores the arrows that move across the splitter', () => {
    expect(keyStepDelta('ArrowUp', 'v')).toBe(0)
    expect(keyStepDelta('ArrowDown', 'v')).toBe(0)
    expect(keyStepDelta('ArrowLeft', 'h')).toBe(0)
    expect(keyStepDelta('ArrowRight', 'h')).toBe(0)
  })

  it('ignores every other key', () => {
    expect(keyStepDelta('Enter', 'v')).toBe(0)
    expect(keyStepDelta('a', 'h')).toBe(0)
    expect(keyStepDelta('Tab', 'v')).toBe(0)
  })
})
