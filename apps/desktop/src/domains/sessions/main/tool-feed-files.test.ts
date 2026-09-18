import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ToolResult } from '../contract/tool-feed'
import { toolCall as call, onlyToolRow } from './tool-feed-test-fixtures'

test('an Edit call carries its diff evidence before the result lands', () => {
  const row = onlyToolRow([
    call({
      id: 'call-1',
      name: 'Edit',
      input: { file_path: 'src/app.ts', old_string: 'a\n', new_string: 'a\nb\n' },
    }),
  ])
  assert.equal(row.status, 'running')
  assert.equal(row.evidence?.kind, 'diff')
  assert.deepEqual(row.lineCounts, { added: 3, removed: 2 })
})

test('a Write call opens as a diff of added lines, never its result text', () => {
  const results = new Map<string, ToolResult>([
    [
      'call-1',
      {
        blocks: [{ shape: 'text', text: 'File created successfully at: src/new.ts' }],
        failed: false,
      },
    ],
  ])
  const row = onlyToolRow(
    [call({ id: 'call-1', name: 'Write', input: { file_path: 'src/new.ts', content: 'a\nb' } })],
    results,
  )
  assert.deepEqual(row.evidence, {
    kind: 'diff',
    title: 'Created new.ts',
    source: '@@ -0,0 +1,2 @@\n+a\n+b',
  })
  assert.deepEqual(row.lineCounts, { added: 2, removed: 0 })
})

test('a Read call with no result yet has no evidence to open', () => {
  const row = onlyToolRow([
    call({ id: 'call-1', name: 'Read', input: { file_path: 'src/app.ts' } }),
  ])
  assert.equal(row.label, 'Read app.ts')
  assert.equal(row.status, 'running')
  assert.equal(row.evidence, null)
})

test('names a file by its last segment, not the absolute path that reached it', () => {
  for (const { name, label } of [
    { name: 'Read', label: 'Read app.ts' },
    { name: 'Edit', label: 'Edited app.ts' },
    { name: 'Write', label: 'Created app.ts' },
  ]) {
    const row = onlyToolRow([
      call({ id: 'call-1', name, input: { file_path: '/Users/someone/project/src/app.ts' } }),
    ])
    assert.equal(row.label, label)
  }
})
