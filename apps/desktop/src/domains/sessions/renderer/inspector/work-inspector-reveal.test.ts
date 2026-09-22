import { expect, test } from 'bun:test'
import { sessionShellCommand } from '../session-fixtures'
import { workInspectorReveal } from './work-inspector-reveal'

const shell = sessionShellCommand({ id: 'codex-command', command: 'bun run typecheck' })

test('does not reveal an inspector for a Shell without output', () => {
  expect(workInspectorReveal('codex-command#1', shell, { state: 'absent' })).toBeNull()
})

test('reveals a Shell inspector when its output is available', () => {
  expect(workInspectorReveal('shell-command#1', shell, { state: 'available', tail: '' })).toBe(
    'shell-command#1',
  )
})

test('reveals a selected Subagent without Shell output', () => {
  expect(workInspectorReveal('subagent#1', null, null)).toBe('subagent#1')
})
