import { describe, expect, it } from 'vitest'
import {
  FINDING_SEVERITIES,
  FINDING_SEVERITY,
  FINDING_STATE_ACTION,
  FINDING_STATE_REPORT,
  FINDING_STATES,
} from './findingState'

describe('finding state vocabulary', () => {
  it('binds every rung of the cycle, in cycle order', () => {
    expect(Object.keys(FINDING_STATE_REPORT)).toEqual([...FINDING_STATES])
    expect(Object.keys(FINDING_STATE_ACTION)).toEqual([...FINDING_STATES])
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

describe('finding severity vocabulary', () => {
  it('binds every severity to a word, an icon and a tone', () => {
    expect(Object.keys(FINDING_SEVERITY)).toEqual([...FINDING_SEVERITIES])
  })

  it('spells each severity word exactly once', () => {
    const words = FINDING_SEVERITIES.map((severity) => FINDING_SEVERITY[severity].word)
    expect(new Set(words).size).toBe(FINDING_SEVERITIES.length)
  })

  it('tones blocking with the block verdict and advisory with the changes verdict', () => {
    expect(FINDING_SEVERITY.blocking.tone).toBe('verdict-block')
    expect(FINDING_SEVERITY.advisory.tone).toBe('verdict-changes')
  })
})
