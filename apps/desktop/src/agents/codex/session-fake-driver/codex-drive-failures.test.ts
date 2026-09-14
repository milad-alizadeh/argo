// The #1839 vertical slice's failure cases, split from codex-vertical-slice.test.ts to stay under
// the file's line cap: driving a Session Codex never launched, and Codex being unavailable.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sendSession, startSession } from '@/core/sessions/drive.ts'
import { createCodexSessionDriver } from '../drive/codex-session-driver.ts'
import { createCodexDriveAdapter } from '../drive/session-drive-adapter.ts'
import { driverBackedByFixture, ownerCliFor } from './fixture-driver.ts'

test('driving a Session Codex never launched reports a drivable failure, not a stall', async () => {
  const driver = driverBackedByFixture()
  const adapters = { codex: createCodexDriveAdapter(driver) }
  const reply = await sendSession(
    {
      version: 1,
      type: 'session.send',
      requestId: 'send-2',
      sessionId: 'never-started',
      prompt: 'x',
    },
    adapters,
    ownerCliFor,
  )
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'not-drivable')
})

test('Codex being unavailable on the machine reports an honest start failure', async () => {
  const driver = createCodexSessionDriver({
    findExecutable: () => null,
    now: () => new Date(),
    openChannel: () => {
      throw new Error('unreachable')
    },
  })
  const adapters = { codex: createCodexDriveAdapter(driver) }
  const reply = await startSession(
    {
      version: 1,
      type: 'session.start',
      requestId: 'start-3',
      cli: 'codex',
      cwd: process.cwd(),
      prompt: 'Inspect the failing test.',
    },
    adapters,
  )
  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'cli-unavailable')
})
