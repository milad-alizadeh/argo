import { describe, expect, it } from 'vitest'
import { phaseOpensByDefault, phaseStatusText } from './phaseState'

describe('phaseOpensByDefault', () => {
  it('opens the phase being worked and collapses the rest', () => {
    expect(phaseOpensByDefault('run')).toBe(true)
    expect(phaseOpensByDefault('done')).toBe(false)
    expect(phaseOpensByDefault('wait')).toBe(false)
  })
})

describe('phaseStatusText', () => {
  it('reports the phase word with its done fraction', () => {
    expect(phaseStatusText('done', 4, 4)).toBe('done 4/4')
    expect(phaseStatusText('run', 3, 1)).toBe('running 1/3')
  })

  it('drops the fraction when the phase has no members to count', () => {
    expect(phaseStatusText('wait', 0, 0)).toBe('queued')
  })

  it('still reports a fraction for a queued phase that already has members', () => {
    expect(phaseStatusText('wait', 2, 0)).toBe('queued 0/2')
  })
})
