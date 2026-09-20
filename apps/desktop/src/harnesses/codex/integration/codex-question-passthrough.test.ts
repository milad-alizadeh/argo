// A regression check beside codex-question-vertical-slice.test.ts: the "ASK" trigger the fixture
// gained for #1841 must not change how an ordinary (non-asking) Turn reaches the transport.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { sendSession, startSession } from '@/domains/sessions/main/drive.ts'
import { createCodexDriveAdapter } from '@/harnesses/codex/drive/session-drive-adapter.ts'
import { driverBackedByFixture } from '../../../../mocks/harness/codex/mock-codex-driver.ts'

test('a Codex Turn still carries the shared editor markdown to the transport when it is not asking', async () => {
  const echoDir = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-question-echo-'))
  const echoFile = path.join(echoDir, 'turns.jsonl')
  writeFileSync(echoFile, '')
  const driver = driverBackedByFixture({ env: { ARGO_CODEX_ECHO_FILE: echoFile } })
  const adapters = { codex: createCodexDriveAdapter(driver) }
  try {
    const startReply = await startSession(
      {
        version: 1,
        type: 'session.start',
        requestId: 'start-not-asking',
        harness: 'codex',
        cwd: process.cwd(),
        prompt: 'Continue without asking.',
      },
      adapters,
    )
    assert.equal(startReply.type, 'session.started')
    const sendReply = await sendSession(
      {
        version: 1,
        type: 'session.send',
        requestId: 'send-not-asking',
        sessionId: startReply.type === 'session.started' ? startReply.sessionId : '',
        prompt: 'Continue without asking.',
      },
      { adapters, ownerCliFor: async () => 'codex' },
    )
    assert.equal(sendReply.type, 'session.accepted')
    const lines = readFileSync(echoFile, 'utf8').trim().split('\n')
    assert.ok(lines.includes(JSON.stringify('Continue without asking.')))
  } finally {
    driver.close()
  }
})
