import assert from 'node:assert/strict'

export async function proveToolCalls(page) {
  const reply = await page.evaluate(() =>
    window.argo.readSessionFeed({ revision: null, sessionId: 'toolCalls' }),
  )
  assert.equal(reply.type, 'session.feed.read')
  assert.deepEqual(
    reply.rows.map((row) => row.shape),
    ['prose', 'tool-group'],
  )
  const group = reply.rows[1]
  assert.equal(group?.shape, 'tool-group')
  assert.equal(group?.label, 'Ran 1 command · Edited 1 file')
}
