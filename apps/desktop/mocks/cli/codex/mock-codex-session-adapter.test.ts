import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { SessionService } from '../../../src/domains/sessions/next/main/session-service.ts'
import { createCodexSessionAdapter } from '../../../src/harnesses/codex/drive/codex-session-adapter.ts'
import { writeMockCodex } from './mock-codex-driver.ts'

function sessionService(): SessionService {
  return {
    acquire: () => ({ posture: 'managed' }),
    renew: () => ({ posture: 'managed' }),
    release: () => {},
  }
}

test('starts a managed Session after the shared app-server handshake', async () => {
  const executable = await writeMockCodex(
    await mkdtemp(path.join(os.tmpdir(), 'argo-codex-adapter-')),
  )
  const adapter = createCodexSessionAdapter({
    findExecutable: () => executable,
    sessionService: sessionService(),
    waitForWorkspaceReady: async () => {},
    now: () => new Date(),
    resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: process.cwd() }),
  })
  try {
    const outcome = await adapter.execute({
      type: 'session.start',
      harness: 'codex',
      prompt: 'Start the managed Session.',
      workspace: { kind: 'main' },
    })
    assert.equal(outcome.kind, 'accepted')
    if (outcome.kind === 'accepted') {
      assert.equal(outcome.projection.session.harness, 'codex')
      assert.equal(outcome.projection.turns.length, 1)
      const retry = await adapter.execute({
        type: 'session.send',
        session: outcome.projection.session,
        prompt: 'Send while the first Turn is still running.',
      })
      assert.equal(retry.kind, 'rejected')
    }
  } finally {
    adapter.close()
  }
})
