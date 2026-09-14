import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { createCodexOwnershipLedger } from '../drive/ownership-ledger.ts'
import { driverBackedByFixture } from './fixture-driver.ts'

test('resumes a Codex Session Argo held before restart in its recorded workspace before accepting its next Turn', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-resume-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const ledger = path.join(root, 'codex-session-ownership.json')
  const first = driverBackedByFixture({
    ownership: createCodexOwnershipLedger({
      path: ledger,
      owner: { pid: 1, registry: 'first-window' },
      isAlive: () => true,
    }),
  })
  const sessionId = await first.start({
    attachments: [],
    cwd: process.cwd(),
    prompt: 'Open the resume proof.',
  })
  first.close()

  const resumed = driverBackedByFixture({
    ownership: createCodexOwnershipLedger({
      path: ledger,
      owner: { pid: 2, registry: 'second-window' },
      isAlive: () => false,
    }),
    resumeTarget: async () => ({ cwd: process.cwd() }),
  })
  context.after(() => resumed.close())

  await resumed.send({
    sessionId,
    text: 'Carry on after the restart.',
    setup: undefined,
    attachments: [],
  })

  assert.deepEqual(
    resumed.roster().map(({ id, cwd, posture }) => ({ id, cwd, posture })),
    [{ id: sessionId, cwd: process.cwd(), posture: 'managed' }],
  )
})
