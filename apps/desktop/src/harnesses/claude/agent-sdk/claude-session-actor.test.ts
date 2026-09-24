import { describe, expect, test } from 'bun:test'
import { createActor } from 'xstate'
import { fakeClaudeQuery } from './claude-query-fixture'
import { createClaudeSessionMachine } from './claude-session-actor'

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function harness(fake: ReturnType<typeof fakeClaudeQuery>) {
  const machine = createClaudeSessionMachine({
    session: null,
    workspaceId: 'workspace-1',
    prompt: 'hello',
    cwd: '/repository',
    startedAt: '2026-09-22T00:00:00.000Z',
    createQuery: fake.createQuery,
  })
  const actor = createActor(machine, {
    input: undefined,
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
    expect(actor.getSnapshot().context.session).toEqual({ harness: 'claude', nativeId: 'native-1' })
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

  test('rejects malformed SDK stream messages at the adapter boundary', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)

    fake.emitMalformedMessage()
    await flush()

    expect(actor.getSnapshot().value).toBe('Unavailable')
  })
})

describe('claude session actor commands', () => {
  test('streams a send command into the SDK as a user message', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()
    await flush()
    actor.send({ type: 'Send', prompt: 'second message' })
    await flush()

    expect(fake.sentPrompts()).toEqual(['hello', 'second message'])
  })

  test('calls interrupt on the underlying SDK query', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'Interrupt' })
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

  test('closes the managed Session after a Close event', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'Close' })
    await flush()

    expect(actor.getSnapshot().value).toBe('Closed')
  })

  test('one authorization sends the initial prompt once', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()
    await flush()

    expect(fake.sentPrompts()).toEqual(['hello'])
    actor.send({ type: 'Channel restored' })
    await flush()
    expect(fake.sentPrompts()).toEqual(['hello'])
  })
})

describe('claude session actor recovery', () => {
  test('becomes watched when channel recovery fails', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake)
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'Channel lost' })
    await flush()
    actor.send({ type: 'SDK failed' })
    await flush()

    expect(actor.getSnapshot().value).toBe('Watched')
  })
})
