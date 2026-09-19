import assert from 'node:assert/strict'
import { test } from 'node:test'
import { patchFiles } from '@/domains/sessions/contract/patch-files'

const TWO_FILES = [
  'Update File: /repo/src/app.ts',
  '@@ -0,0 +0,0 @@',
  '-old',
  '+new',
  'Add File: /repo/docs/note.md',
  '+hello',
].join('\n')

test('a diff that names its files splits into one section per file, each under its own path', () => {
  assert.deepEqual(patchFiles(TWO_FILES, 'Edited 2 files'), [
    { verb: 'Update', path: '/repo/src/app.ts', diff: '@@ -0,0 +0,0 @@\n-old\n+new' },
    { verb: 'Add', path: '/repo/docs/note.md', diff: '+hello' },
  ])
})

test('an Edit diff is one section under the row title', () => {
  assert.deepEqual(patchFiles('@@ -1,1 +1,1 @@\n-a\n+b\n', 'Edited app.ts'), [
    { verb: null, path: 'Edited app.ts', diff: '@@ -1,1 +1,1 @@\n-a\n+b' },
  ])
})
