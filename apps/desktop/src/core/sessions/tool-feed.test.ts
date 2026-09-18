// A Tool Call's lifecycle has two independent halves: whether its result has landed (`status`)
// and whether the inspector has anything to show yet (`evidence`). An Edit's evidence comes from
// its own input (the before/after strings), so it is ready before the result lands; a Bash or
// Read's evidence comes from the result, so it stays null until the call resolves (#2201).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayedToolLabel, type ToolResult } from './tool-feed'
import { toolCall as call, onlyToolRow } from './tool-feed-test-fixtures'

test('a Bash call with no result yet is running with no evidence', () => {
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test' } })],
    new Map(),
  )
  assert.equal(row.status, 'running')
  assert.equal(row.evidence, null)
})

test('a Bash call resolves into output evidence once its result lands', () => {
  const results = new Map<string, ToolResult>([
    ['call-1', { blocks: [{ shape: 'text', text: 'ok\n' }], failed: false }],
  ])
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test' } })],
    results,
  )
  assert.equal(row.status, 'succeeded')
  assert.deepEqual(row.evidence, { kind: 'output', title: 'Ran bun test', source: 'ok\n' })
})

test('a failed Bash result still carries its output as evidence', () => {
  const results = new Map<string, ToolResult>([
    ['call-1', { blocks: [{ shape: 'text', text: 'boom\n' }], failed: true }],
  ])
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test' } })],
    results,
  )
  assert.equal(row.status, 'failed')
  assert.equal(row.evidence?.source, 'boom\n')
})

test('a Bash call with a description labels itself with the description, not the command', () => {
  const row = onlyToolRow(
    [
      call({
        id: 'call-1',
        name: 'Bash',
        input: {
          command: 'RTK_DISABLED=1 git diff --name-only',
          description: 'Listing changed files',
        },
      }),
    ],
    new Map(),
  )
  assert.equal(row.label, 'Listing changed files')
})

test('a Bash call with no description falls back to the command, first line only', () => {
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test\nextra line' } })],
    new Map(),
  )
  assert.equal(row.label, 'Ran bun test')
})

test('a Codex exec_command call reads as a command, the same as Bash', () => {
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'exec_command', input: { cmd: 'bun test\nextra line' } })],
    new Map(),
  )
  assert.equal(row.kind, 'command')
  assert.equal(row.label, 'Ran bun test')
  assert.equal(row.text, 'bun test\nextra line')
})

test('a Codex command prefers its supplied label to the raw command', () => {
  const row = onlyToolRow(
    [
      call({
        id: 'call-1',
        name: 'exec_command',
        input: { cmd: 'bun run typecheck', label: 'Checking types' },
      }),
    ],
    new Map(),
  )
  assert.equal(row.label, 'Checking types')
  assert.equal(displayedToolLabel(row, true, 'Running'), 'Running Checking types')
})

test('a Codex custom exec call keeps its literal command in its details', () => {
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'exec', input: { input: 'wrapper source', cmd: 'echo hi' } })],
    new Map(),
  )
  assert.equal(row.kind, 'command')
  assert.equal(row.label, 'Ran echo hi')
  assert.equal(row.text, 'echo hi')
})
