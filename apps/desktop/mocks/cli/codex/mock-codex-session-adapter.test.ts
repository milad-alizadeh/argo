import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionProjection } from '../../../src/domains/sessions/next/contract/session-projection-contract.ts'
import {
  createAdapter,
  createMockAdapter,
  mockCodexExecutable,
} from './mock-codex-session-adapter-support.ts'

test('starts a managed Session after the shared app-server handshake', async () => {
  const adapter = await createMockAdapter()
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

test('shares one app-server process across managed Session windows', async () => {
  const executable = await mockCodexExecutable()
  const first = createAdapter(executable)
  const second = createAdapter(executable)
  try {
    const [one, two] = await Promise.all([
      first.execute({
        type: 'session.start',
        harness: 'codex',
        prompt: 'First Session.',
        workspace: { kind: 'main' },
      }),
      second.execute({
        type: 'session.start',
        harness: 'codex',
        prompt: 'Second Session.',
        workspace: { kind: 'main' },
      }),
    ])
    assert.equal(one.kind, 'accepted')
    assert.equal(two.kind, 'accepted')
    if (one.kind !== 'accepted' || two.kind !== 'accepted') return
    assert.notEqual(one.projection.session.nativeId, two.projection.session.nativeId)
  } finally {
    first.close()
    second.close()
  }
})

test('projects app-server tool calls and cumulative token usage', async () => {
  const adapter = await createMockAdapter()
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
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for tool projection')),
        1_000,
      )
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
