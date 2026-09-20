// A Tool Call's lifecycle has two independent halves: whether its result has landed (`status`)
// and whether the inspector has anything to show yet (`evidence`). An Edit's evidence comes from
// its own input (the before/after strings), so it is ready before the result lands; a command's
// evidence comes from the result, so it stays null until the call resolves (#2201). A command is
// read by its kind (`execute`); how each harness fills it is tested at that harness's Session source.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayedToolLabel, type ToolResult } from '@/domains/sessions/contract/model/tool-feed'
import {
  executeCall as command,
  onlyToolRow,
} from '@/domains/sessions/main/projection/tool-feed-test-fixtures'

test('a command with no result yet is running with no evidence', () => {
  const row = onlyToolRow([command({ id: 'call-1', command: 'bun test' })], new Map())
  assert.equal(row.status, 'running')
  assert.equal(row.evidence, null)
})

test('a command resolves into output evidence once its result lands', () => {
  const results = new Map<string, ToolResult>([
    ['call-1', { blocks: [{ shape: 'text', text: 'ok\n' }], failed: false }],
  ])
  const row = onlyToolRow([command({ id: 'call-1', command: 'bun test' })], results)
  assert.equal(row.status, 'succeeded')
  assert.deepEqual(row.evidence, { kind: 'output', title: 'Ran bun test', source: 'ok\n' })
})

test('a failed command result still carries its output as evidence', () => {
  const results = new Map<string, ToolResult>([
    ['call-1', { blocks: [{ shape: 'text', text: 'boom\n' }], failed: true }],
  ])
  const row = onlyToolRow([command({ id: 'call-1', command: 'bun test' })], results)
  assert.equal(row.status, 'failed')
  assert.equal(row.evidence?.source, 'boom\n')
})

test('a command labels itself with its label, not the command it ran', () => {
  const row = onlyToolRow(
    [command({ id: 'call-1', command: 'bun run typecheck', label: 'Checking types' })],
    new Map(),
  )
  assert.equal(row.kind, 'command')
  assert.equal(row.label, 'Checking types')
  assert.equal(displayedToolLabel(row, true, 'Running'), 'Running Checking types')
})

// A background command's receipt is not its result: it runs until a later record ends it.
for (const [ended, status] of [
  ['completed', 'succeeded'],
  ['failed', 'failed'],
  ['interrupted', 'interrupted'],
] as const) {
  test(`a background command that ${ended} reads as ${status}`, () => {
    const receipt: ToolResult = { blocks: [], failed: false, background: true }
    const watch = command({ id: 'call-1', command: 'npm run watch', background: true })
    const running = onlyToolRow([watch], new Map([['call-1', receipt]]))
    assert.equal(running.status, 'running')
    const settled = onlyToolRow([watch], new Map([['call-1', { ...receipt, ended }]]))
    assert.equal(settled.status, status)
  })
}
