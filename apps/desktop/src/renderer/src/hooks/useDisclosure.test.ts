import { describe, expect, it } from 'vitest'
import { disclosureReducer } from './useDisclosure'

describe('disclosureReducer', () => {
  it('opens regardless of the current state', () => {
    expect(disclosureReducer(false, 'open')).toBe(true)
    expect(disclosureReducer(true, 'open')).toBe(true)
  })

  it('closes regardless of the current state', () => {
    expect(disclosureReducer(true, 'close')).toBe(false)
    expect(disclosureReducer(false, 'close')).toBe(false)
  })

  it('toggle flips whichever state it is given', () => {
    expect(disclosureReducer(false, 'toggle')).toBe(true)
    expect(disclosureReducer(true, 'toggle')).toBe(false)
  })
})
