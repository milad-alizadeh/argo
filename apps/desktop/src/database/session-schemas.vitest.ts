import assert from 'node:assert/strict'
import { test } from 'vitest'
import { sessionInsertSchema, sessionSelectSchema } from './session-schemas'

test('Session select validation follows persisted nullability and required fields', () => {
  const parsed = sessionSelectSchema.parse({
    argoId: 'argo-1',
    harness: 'claude',
    nativeId: 'native-1',
    projectId: null,
    customTitle: null,
    preview: null,
    firstPrompt: null,
    cwd: null,
    createdAt: 1,
    updatedAt: 2,
  })
  assert.equal(parsed.projectId, null)
  assert.equal(parsed.customTitle, null)
  assert.throws(() => sessionSelectSchema.parse({ ...parsed, updatedAt: undefined }))
  assert.throws(() => sessionSelectSchema.parse({ ...parsed, projectId: 1 }))
})

test('Session insert validation omits server-owned fields and allows database defaults', () => {
  const parsed = sessionInsertSchema.parse({ harness: 'claude', nativeId: 'native-1' })
  assert.deepEqual(parsed, { harness: 'claude', nativeId: 'native-1' })
  assert.deepEqual(
    sessionInsertSchema.parse({
      argoId: 'server-owned',
      harness: 'claude',
      nativeId: 'native-1',
    }),
    { harness: 'claude', nativeId: 'native-1' },
  )
})
