// A Tool Call's lifecycle has two independent halves: whether its result has landed (`status`)
// and whether the inspector has anything to show yet (`evidence`). An Edit's evidence comes from
// its own input (the before/after strings), so it is ready before the result lands; a Bash or
// Read's evidence comes from the result, so it stays null until the call resolves (#2201).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionFeedRow } from './feed-rows'
import { type ToolResult, toolRows } from './tool-feed'
import type { ToolCall } from './transcript'

type ToolRow = Extract<SessionFeedRow, { shape: 'tool' }>

function call(overrides: Partial<ToolCall> & { id: string; name: string }): ToolCall {
  return { input: {}, ...overrides }
}

function onlyToolRow(calls: ToolCall[], results: Map<string, ToolResult>): ToolRow {
  const [row] = toolRows(calls, { results, skillBodies: new Map() })
  if (row === undefined || row.shape !== 'tool') throw new Error('expected a tool row')
  return row
}

test('a Bash call with no result yet is running with no evidence', () => {
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test' } })],
    new Map(),
  )
  assert.equal(row.status, 'running')
  assert.equal(row.evidence, null)
})

test('a Bash call resolves into output evidence once its result lands', () => {
  const results = new Map<string, ToolResult>([['call-1', { content: 'ok\n', failed: false }]])
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test' } })],
    results,
  )
  assert.equal(row.status, 'succeeded')
  assert.deepEqual(row.evidence, { kind: 'output', title: 'Ran bun test', source: 'ok\n' })
})

test('a failed Bash result still carries its output as evidence', () => {
  const results = new Map<string, ToolResult>([['call-1', { content: 'boom\n', failed: true }]])
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Bash', input: { command: 'bun test' } })],
    results,
  )
  assert.equal(row.status, 'failed')
  assert.equal(row.evidence?.source, 'boom\n')
})

test('an Edit call carries its diff evidence before the result lands', () => {
  const row = onlyToolRow(
    [
      call({
        id: 'call-1',
        name: 'Edit',
        input: { file_path: 'src/app.ts', old_string: 'a\n', new_string: 'a\nb\n' },
      }),
    ],
    new Map(),
  )
  assert.equal(row.status, 'running')
  assert.equal(row.evidence?.kind, 'diff')
  assert.deepEqual(row.lineCounts, { added: 3, removed: 2 })
})

test('a Read call with no result yet has no evidence to open', () => {
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Read', input: { file_path: 'src/app.ts' } })],
    new Map(),
  )
  assert.equal(row.status, 'running')
  assert.equal(row.evidence, null)
})
