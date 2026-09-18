import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toolRows } from '../contract/tool-feed'
import { readPatch } from './apply-patch'

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

test('an update patch reads as an edit of its file with its line counts', () => {
  const change = readPatch(UPDATE)
  assert.equal(change?.kind, 'edited')
  assert.equal(change?.label, 'Edited app.ts')
  assert.deepEqual(change?.lineCounts, { added: 2, removed: 1 })
  assert.equal(change?.diff.split('\n')[0], 'Update File: /repo/src/app.ts')
})

test('an add patch reads as a created file, and several files as a count', () => {
  const added = readPatch('*** Begin Patch\n*** Add File: /repo/a.md\n+hello\n*** End Patch')
  assert.equal(added?.kind, 'created')
  assert.equal(added?.label, 'Created a.md')
  const many = readPatch(
    '*** Begin Patch\n*** Add File: /repo/a.md\n+a\n*** Delete File: /repo/b.md\n*** End Patch',
  )
  assert.equal(many?.label, 'Edited 2 files')
})

test('an apply_patch row carries its diff as evidence, like an Edit', () => {
  const [row] = toolRows([{ id: 'p', name: 'apply_patch', input: { patch: UPDATE } }], {
    results: new Map(),
    skillBodies: new Map(),
  })
  assert.equal(row?.shape === 'tool' ? row.label : null, 'Edited app.ts')
  assert.equal(row?.shape === 'tool' ? row.evidence?.kind : null, 'diff')
  assert.deepEqual(row?.shape === 'tool' ? row.lineCounts : null, { added: 2, removed: 1 })
})
