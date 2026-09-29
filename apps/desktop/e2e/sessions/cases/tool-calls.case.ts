import assert from 'node:assert/strict'
import { feedRows, sessionFeed, sessionRows } from '../page-trpc'

export async function proveToolCalls(page) {
  const roster = await sessionRows(page)
  const session = roster.find((row) => row.id === 'toolCalls')
  assert.notEqual(session, undefined)
  const reply = await sessionFeed(page, session.id)
  assert.equal(reply.type, 'session.feed.reading', JSON.stringify(reply))
  assert.equal(reply.state, 'ready')
  const rows = feedRows(reply)
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'tool-group'],
  )
  const group = rows[1]
  assert.equal(group?.shape, 'tool-group')
  assert.equal(group?.label, 'Ran a command, edited a file')
}
