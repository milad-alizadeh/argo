import { describe, expect, it } from 'vitest'
import { FINDING_STATE_ACTION, FINDING_STATE_REPORT, FINDING_STATES } from './findingState'

describe('finding state vocabulary', () => {
  it('reports every state with a word, a glyph and a tone', () => {
    for (const state of FINDING_STATES) {
      const report = FINDING_STATE_REPORT[state]
      expect(report.label).not.toBe('')
      expect(report.Icon).toBeTypeOf('function')
      expect(report.tone).toMatch(/^verdict-/)
    }
  })

  it('offers every state a next action with a word, a glyph and a tone', () => {
    for (const state of FINDING_STATES) {
      const action = FINDING_STATE_ACTION[state]
      expect(action.label).not.toBe('')
      expect(action.title).not.toBe('')
      expect(action.Icon).toBeTypeOf('function')
    }
  })

  it('spells each word exactly once across the cycle', () => {
    const reported = FINDING_STATES.map((state) => FINDING_STATE_REPORT[state].label)
    const acted = FINDING_STATES.map((state) => FINDING_STATE_ACTION[state].label)
    expect(new Set(reported).size).toBe(FINDING_STATES.length)
    expect(new Set(acted).size).toBe(FINDING_STATES.length)
  })

  it('never labels the control with the state it reports', () => {
    for (const state of FINDING_STATES) {
      expect(FINDING_STATE_ACTION[state].label).not.toBe(FINDING_STATE_REPORT[state].label)
    }
  })

  // The reason a primitive variant cannot be named after a state: `open` is reported in the
  // block tone and acted on in the changes tone, so one state wears two different tokens.
  it('tones the report and the action independently', () => {
    expect(FINDING_STATE_REPORT.open.tone).toBe('verdict-block')
    expect(FINDING_STATE_ACTION.open.tone).toBe('verdict-changes')
  })
})
