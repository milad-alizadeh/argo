import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fed, feedRequest, rowsOf } from '../../../domains/sessions/main/reader-test-helpers'
import { readPatchFiles } from './apply-patch'
import { readerOverRollout } from './rollout-reader-test-helper'

const UPDATE = [
  '*** Begin Patch',
  '*** Update File: /repo/src/app.ts',
  '@@',
  ' context',
  '-old',
  '+new',
  '+newer',
  '*** End Patch',
].join('\n')

test('an update patch reads as an update of its file with its line counts', () => {
  const [file, ...rest] = readPatchFiles(UPDATE)
  assert.equal(rest.length, 0)
  assert.equal(file?.change, 'update')
  assert.equal(file?.file, '/repo/src/app.ts')
  assert.deepEqual(file?.lineCounts, { added: 2, removed: 1 })
  assert.equal(file?.diff.split('\n')[0], 'Update File: /repo/src/app.ts')
})

test('a patch over several files reads one change per file', () => {
  const files = readPatchFiles(
    '*** Begin Patch\n*** Add File: /repo/a.md\n+a\n*** Delete File: /repo/b.md\n*** End Patch',
  )
  assert.deepEqual(
    files.map(({ change, file }) => ({ change, file })),
    [
      { change: 'create', file: '/repo/a.md' },
      { change: 'delete', file: '/repo/b.md' },
    ],
  )
})

test('a deleted file shows as deleted in the Feed', async (context) => {
  const reader = await readerOverRollout(context, {
    fixture: 'rollout-codexDelete.jsonl',
    session: 'codexDelete',
  })
  const rows = rowsOf(await fed(reader, feedRequest('codexDelete')))
  const calls = rows.flatMap((row) => (row.shape === 'tool-group' ? row.calls : []))
  assert.deepEqual(
    calls.map(({ kind, label, status }) => ({ kind, label, status })),
    [{ kind: 'deleted', label: 'Deleted old.md', status: 'succeeded' }],
  )
})
