import { describe, expect, test } from 'bun:test'
import { acpConfigSelect } from './acp-catalog'

const select = (category: string, currentValue: unknown) => ({
  id: category,
  name: category,
  category,
  type: 'select',
  currentValue,
  options: [{ value: 'one', name: 'One' }],
})

describe('acpConfigSelect', () => {
  test('tells an unreadable option in the category apart from an absent one', () => {
    expect(acpConfigSelect([select('model', 7)], 'model').kind).toBe('invalid')
    expect(acpConfigSelect([select('mode', 'one')], 'model').kind).toBe('absent')
    expect(acpConfigSelect([select('model', 'one')], 'model').kind).toBe('reported')
  })
})
