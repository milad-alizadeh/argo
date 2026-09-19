import assert from 'node:assert/strict'
import { test } from 'node:test'
import { editCall, onlyToolRow, readCall } from './tool-feed-test-fixtures'

test('a file read with no result yet has no evidence to open', () => {
  const row = onlyToolRow([readCall('call-1', 'src/app.ts')])
  assert.equal(row.label, 'Read app.ts')
  assert.equal(row.status, 'running')
  assert.equal(row.evidence, null)
})

test('names a file by its last segment, not the absolute path that reached it', () => {
  const read = onlyToolRow([readCall('call-1', '/Users/someone/project/src/app.ts')])
  assert.equal(read.label, 'Read app.ts')
  for (const { change, label } of [
    { change: 'update', label: 'Edited app.ts' },
    { change: 'create', label: 'Created app.ts' },
    { change: 'delete', label: 'Deleted app.ts' },
  ] as const) {
    const row = onlyToolRow([editCall('call-1', '/Users/someone/project/src/app.ts', change)])
    assert.equal(row.label, label)
  }
})
