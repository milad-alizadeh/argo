import { describe, expect, test } from 'bun:test'
import { acpConfigSelect, acpHarnessInfo } from './acp-catalog'

const presentation = { agent: 'Agent', label: 'Agent', modeIcon: () => 'mode-auto' as const }
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

describe('acpHarnessInfo', () => {
  test('reports an invalid catalog when the agent sends a Turn setting it cannot read', () => {
    const info = acpHarnessInfo(
      'claude-acp',
      [select('model', 'one'), select('thought_level', 7), select('mode', 'one')],
      presentation,
    )
    expect(info.availability).not.toBe('available')
  })
})
