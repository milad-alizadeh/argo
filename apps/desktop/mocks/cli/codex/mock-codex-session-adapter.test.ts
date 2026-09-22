import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { SessionService } from '../../../src/domains/sessions/next/main/session-service.ts'
import type { SessionProjection } from '../../../src/domains/sessions/next/contract/session-projection-contract.ts'
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

test('projects app-server tool calls and cumulative token usage', async () => {
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
      prompt: 'PROJECT_TOOL_USAGE',
      workspace: { kind: 'main' },
    })
    assert.equal(outcome.kind, 'accepted')
    if (outcome.kind !== 'accepted') return
    const projection = await new Promise<SessionProjection>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for tool projection')), 1_000)
      const unsubscribe = adapter.subscribe(outcome.projection.session, (next) => {
        if (next.toolCalls.length === 0 || next.usage.inputTokens === 0) return
        clearTimeout(timeout)
        unsubscribe()
        resolve(next)
      })
    })
    assert.equal(projection.toolCalls.length, 1)
    assert.equal(projection.toolCalls[0]?.turnId, projection.turns[0]?.id)
    assert.equal(projection.toolCalls[0]?.name, 'rtk bun run typecheck')
    assert.equal(projection.toolCalls[0]?.status, 'running')
    assert.deepEqual(projection.usage, { inputTokens: 23, outputTokens: 5 })
  } finally {
    adapter.close()
  }
})
