import { expect, test } from 'bun:test'
import { displayedToolLabel } from './displayed-tool-label'

test('a running command reads as Running plus the command', () => {
  expect(displayedToolLabel({ kind: 'command', label: 'Ran bun test' }, true, 'Running')).toBe(
    'Running bun test',
  )
})

test('an agent-written label stays as written while the call runs', () => {
  expect(
    displayedToolLabel(
      { kind: 'command', label: 'Checking types', agentDescription: true },
      true,
      'Running',
    ),
  ).toBe('Checking types')
})

test('a settled call keeps the label the reading published', () => {
  expect(displayedToolLabel({ kind: 'command', label: 'Ran bun test' }, false, 'Running')).toBe(
    'Ran bun test',
  )
})
