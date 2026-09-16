import assert from 'node:assert/strict'
import { test } from 'node:test'

import { startSession } from '@/core/sessions/drive.ts'
import { createCodexDriveAdapter } from '../../../src/agents/codex/drive/session-drive-adapter.ts'
import { SESSION_MOCK_ADVERSARIAL_SEED_ENV } from '../../../src/core/sessions/proof-protocol.ts'
import { driverBackedByFixture } from './mock-codex-driver.ts'

test('a seeded Codex reply survives a split through a multi-byte character', async () => {
  const driver = driverBackedByFixture({
    env: { [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: 'alpha' },
  })
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const started = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-seeded-reply',
        cli: 'codex',
        cwd: process.cwd(),
        prompt: 'Keep this complete.',
      },
      adapters,
    )
    assert.equal(started.type, 'session.started')
    const sessionId = started.type === 'session.started' ? started.sessionId : ''
    await new Promise((resolve) => setTimeout(resolve, 150))
    const messages = driver.liveMessages(sessionId)
    assert.equal(messages.length, 1)
    assert.equal(messages[0]?.text, 'Mock Codex read: Keep this complete. 🦜')
    assert.equal(driver.roster().find((session) => session.id === sessionId)?.status, 'idle')
  } finally {
    driver.close()
  }
})

test('a seeded Codex failure and stall stay visible as distinct adverse states', async () => {
  const failing = driverBackedByFixture({
    env: { [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: 'seed-3' },
  })
  const stalled = driverBackedByFixture({
    env: { [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: 'seed-17' },
  })
  try {
    const failed = await failing.start({
      cwd: process.cwd(),
      prompt: 'Fail this Turn.',
      attachments: [],
    })
    const stalledId = await stalled.start({
      cwd: process.cwd(),
      prompt: 'Stall this Turn.',
      attachments: [],
    })
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert.equal(failing.roster().find((session) => session.id === failed)?.status, 'unknown')
    assert.equal(stalled.roster().find((session) => session.id === stalledId)?.status, 'running')
  } finally {
    failing.close()
    stalled.close()
  }
})
