import assert from 'node:assert/strict'
import { test } from 'vitest'
import { SessionListChanges } from './session-list-changes'

test('a listener that throws does not starve the next listener', async () => {
  const changes = new SessionListChanges()
  const heard: (readonly string[])[] = []
  changes.subscribe(() => {
    throw new Error('listener failed')
  })
  changes.subscribe((sessionIds) => heard.push(sessionIds))
  changes.changed(['session-1'])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(heard, [['session-1']])
})
