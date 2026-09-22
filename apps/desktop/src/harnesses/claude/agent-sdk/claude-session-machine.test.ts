import { describe, expect, test } from 'bun:test'
import { createActor } from 'xstate'
import {
  fakeClaudeQuery,
  managedSessionService,
} from '@/harnesses/claude/agent-sdk/claude-query-fixture'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-machine'

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function harness(fake: ReturnType<typeof fakeClaudeQuery>, sessionService = managedSessionService) {
  const machine = createClaudeSessionMachine({
    session: null,
    workspaceId: 'workspace-1',
    prompt: 'hello',
    cwd: '/repository',
    startedAt: '2026-09-22T00:00:00.000Z',
    createQuery: fake.createQuery,
    sessionService,
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

  test('becomes watched when another Argo window holds the Session lease', async () => {
    const fake = fakeClaudeQuery()
    const actor = harness(fake, {
      ...managedSessionService,
      acquire: () => ({ posture: 'watched' }),
    })

    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    expect(actor.getSnapshot().value).toBe('Watched')
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

  test('releases its lease when the Session closes', async () => {
    let held = false
    const fake = fakeClaudeQuery()
    const actor = harness(fake, {
      acquire: () => {
        held = true
        return { posture: 'managed' }
      },
      renew: () => ({ posture: 'managed' }),
      release: () => {
        held = false
      },
    })
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'Close' })
    await flush()

    expect(held).toBe(false)
    expect(actor.getSnapshot().value).toBe('Closed')
  })
})

describe('claude session actor recovery', () => {
  test('releases its lease and becomes watched when recovery fails', async () => {
    let released = false
    const fake = fakeClaudeQuery()
    const actor = harness(fake, {
      ...managedSessionService,
      release: () => {
        released = true
      },
    })
    fake.emitInit({ apiKeySource: 'none' })
    await flush()

    actor.send({ type: 'Channel lost' })
    await flush()
    actor.send({ type: 'SDK failed' })
    await flush()

    expect(released).toBe(true)
    expect(actor.getSnapshot().value).toBe('Watched')
  })
})
