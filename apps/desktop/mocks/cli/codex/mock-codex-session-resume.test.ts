import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { SessionSendInput } from '@/domains/sessions/main/api/session-submit'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable } from './mock-codex-driver.ts'
import { openLiveSession, waitFor } from './mock-codex-live-session.ts'

test('sends a follow-up Turn to a Codex Session this window does not hold yet', async () => {
  const echoFile = path.join(await mkdtemp(path.join(os.tmpdir(), 'argo-codex-echo-')), 'echo')
  const executable = await mockCodexExecutable({ ARGO_CODEX_ECHO_FILE: echoFile })
  const firstClient = clientBackedByMock(executable)
  const first = openLiveSession(firstClient, {
    ...mockStartInput,
    prompt: 'Open the resume proof.',
  })
  await waitFor(() => first.has('turn.completed'))
  const nativeId = first.nativeId()
  assert.ok(nativeId)
  first.channel.close()
  firstClient.shutdown()

  const resumedClient = clientBackedByMock(executable)
  const resume: SessionSendInput = {
    commandId: randomUUID(),
    prompt: 'Carry on after the restart.',
    attachments: [],
    turnConfiguration: mockStartInput.turnConfiguration,
    sessionId: randomUUID(),
    resume: {
      harness: 'codex',
      nativeId,
      projectId: mockStartInput.projectId,
      cwd: mockStartInput.cwd,
    },
  }
  const resumed = openLiveSession(resumedClient, resume)
  try {
    await waitFor(() => resumed.has('turn.completed'))
    assert.equal(resumed.nativeId(), nativeId)
    assert.equal(resumed.has('failure'), false)
    assert.match(await readFile(echoFile, 'utf8'), /Carry on after the restart\./)
  } finally {
    resumed.channel.close()
    resumedClient.shutdown()
  }
})
