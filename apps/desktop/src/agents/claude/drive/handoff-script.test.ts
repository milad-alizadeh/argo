import assert from 'node:assert/strict'
import { test } from 'node:test'
import { briefPath, handoffCommand, handoffOpening } from './handoff-script'

test('the brief path is a markdown file under the given root, scoped to the Session and moment', () => {
  const path = briefPath({ root: '/tmp/handoffs', sessionId: 'abc-123', atMs: 42 })
  assert.equal(path, '/tmp/handoffs/handoff-abc-123-42.md')
})

test('the brief path keeps only letters, digits and hyphens from a Session id, cut to the last 24', () => {
  const path = briefPath({
    root: '/tmp/handoffs',
    sessionId: 'weird/id:with*chars!and-a-very-long-suffix-1234567890',
    atMs: 1,
  })
  assert.equal(path, '/tmp/handoffs/handoff-y-long-suffix-1234567890-1.md')
})

test('an empty Session id falls back to a plain token', () => {
  const path = briefPath({ root: '/tmp/handoffs', sessionId: '///', atMs: 1 })
  assert.equal(path, '/tmp/handoffs/handoff-session-1.md')
})

test('the command names the exact absolute path and puts it last', () => {
  const command = handoffCommand('/tmp/handoffs/handoff-abc-1.md')
  assert.match(command, /^\/handoff /)
  assert.ok(command.endsWith('/tmp/handoffs/handoff-abc-1.md'))
})

test('the opening prompt points the fresh Session at the brief rather than pasting it', () => {
  const opening = handoffOpening('/tmp/handoffs/handoff-abc-1.md')
  assert.equal(
    opening,
    'Read the handoff brief at /tmp/handoffs/handoff-abc-1.md. Continue the work it describes.',
  )
})
