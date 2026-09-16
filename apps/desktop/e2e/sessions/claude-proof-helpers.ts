import assert from 'node:assert/strict'

export async function rosterRow(page, sessionId) {
  const reply = await page.evaluate(() => window.argo.listSessions({ projectRoot: null }))
  assert.equal(reply.type, 'session.listed')
  return reply.sessions.filter((session) => session.id === sessionId)
}

export async function waitFor(condition, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('The mock claude never wrote its transcript.')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
