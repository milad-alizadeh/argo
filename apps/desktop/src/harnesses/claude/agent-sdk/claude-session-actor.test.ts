import { describe, expect, test } from 'bun:test'
import { createActor } from 'xstate'
import {
  type FakeClaudeQuery,
  fakeClaudeQuery,
} from '@/harnesses/claude/agent-sdk/claude-query-fixture'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function harness(fake: FakeClaudeQuery) {
  const machine = createClaudeSessionMachine({
    session: { harness: 'claude', nativeId: 'native-1' },
    prompt: 'hello',
    cwd: '/repository',
    createQuery: fake.createQuery,
  })
  const actor = createActor(machine, {
    input: { session: { harness: 'claude', nativeId: 'native-1' } },
  })
  actor.start()
  return actor
}

describe('claude session actor authorization', () => {
  test('reports ready once the SDK confirms subscription authorization', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)

    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    expect(actor.getSnapshot().value).toBe('Managed')
    expect(actor.getSnapshot().context.sourceHealth).toBe('ready')
  })

  test('rejects an inherited API key without falling back to API billing', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)

    fake.emitInit({ apiKeySource: 'ANTHROPIC_API_KEY' })
    await flush()

    expect(actor.getSnapshot().value).toBe('Unavailable')
    expect(actor.getSnapshot().context.sourceHealth).toBe('unavailable')
    expect(fake.closed).toBe(true)
  })

  test('rejects a managed-key login without falling back to API billing', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)

    fake.emitInit({ apiKeySource: '/login managed key' })
    await flush()

    expect(actor.getSnapshot().value).toBe('Unavailable')
  })

  test('becomes unavailable when authorization fails at runtime, never selecting API billing', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)

    fake.emitInit({ apiKeySource: 'none' })
    await flush()
    fake.emitAssistantError('authentication_failed')
    await flush()

    expect(actor.getSnapshot().value).toBe('Unavailable')
    expect(actor.getSnapshot().context.sourceHealth).toBe('unavailable')
  })
})

describe('claude session actor commands', () => {
  test('streams a send command into the SDK as a user message', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'session.send', prompt: 'second message' })
    await flush()

    expect(fake.sentPrompts()).toEqual(['hello', 'second message'])
  })

  test('calls interrupt on the underlying SDK query', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'session.interrupt' })
    await flush()

    expect(fake.interruptCalls).toBe(1)
  })

  test('closes the SDK query when the actor stops', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.stop()

    expect(fake.closed).toBe(true)
  })
})
