import assert from 'node:assert/strict'
import { test } from 'vitest'
import { TicketChanges } from './ticket-changes'

test('a listener that throws neither fails the announcement nor starves the next listener', () => {
  const changes = new TicketChanges()
  const heard: string[] = []
  changes.subscribe(() => {
    throw new Error('listener failed')
  })
  changes.subscribe(({ scope }) => heard.push(scope))
  const { changed } = changes
  changed({ provider: 'github', scope: 'octo/hello' })
  assert.deepEqual(heard, ['octo/hello'])
})
