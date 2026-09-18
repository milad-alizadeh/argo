import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readPatch } from './apply-patch'
import { patchFiles } from './patch-files'

const TWO_FILES = [
  '*** Begin Patch',
  '*** Update File: /repo/src/app.ts',
  '@@',
  '-old',
  '+new',
  '*** Add File: /repo/docs/note.md',
  '+hello',
  '*** End Patch',
].join('\n')

test('an apply_patch diff splits into one section per file, each under its own path', () => {
  const change = readPatch(TWO_FILES)
  assert.deepEqual(patchFiles(change?.diff ?? '', 'Edited 2 files'), [
    { verb: 'Update', path: '/repo/src/app.ts', diff: '@@ -0,0 +0,0 @@\n-old\n+new' },
    { verb: 'Add', path: '/repo/docs/note.md', diff: '+hello' },
  ])
})

test('an Edit diff is one section under the row title', () => {
  assert.deepEqual(patchFiles('@@ -1,1 +1,1 @@\n-a\n+b\n', 'Edited app.ts'), [
    { verb: null, path: 'Edited app.ts', diff: '@@ -1,1 +1,1 @@\n-a\n+b' },
  ])
})
