import assert from 'node:assert/strict'
import { test } from 'node:test'

import { driverBackedByFixture } from './mock-codex-driver.ts'

test('a managed Codex Plan is projected into the shared Roster', async () => {
  const driver = driverBackedByFixture()
  let rosterChanges = 0
  const stopWatching = driver.onRosterChanged(() => {
    rosterChanges += 1
  })
  try {
    const sessionId = await driver.start({
      cwd: process.cwd(),
      prompt: 'PLAN_EARLY the Session projection.',
      attachments: [],
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    assert.deepEqual(driver.roster().find((session) => session.id === sessionId)?.plan, {
      state: 'available',
      entries: [
        { content: 'Read the Session protocol', position: 0, status: 'completed' },
        { content: 'Project the live Plan into the Roster', position: 1, status: 'in_progress' },
      ],
    })
    assert.equal(rosterChanges, 1)
  } finally {
    stopWatching()
    driver.close()
  }
})
