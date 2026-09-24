import { expect, test } from 'bun:test'
import { fakeClaudeQuery } from './claude-query-fixture'
import { createClaudeSessionAdapter } from './claude-session-adapter'

function managedAdapter(fake: ReturnType<typeof fakeClaudeQuery>) {
  return createClaudeSessionAdapter({
    waitForWorkspaceReady: async () => {},
    resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: '/repository' }),
    createQuery: fake.createQuery,
    readResumePermission: async () => ({ resumable: true }),
    readModelCatalog: async () => ({
      data: [
        {
          value: 'haiku',
          resolvedModel: 'claude-haiku-4-5',
          displayName: 'Haiku',
          description: '',
          supportedEffortLevels: ['low'],
        },
      ],
      supportedPermissionModes: ['manual'],
    }),
  })
}

async function startDeferredSession(
  adapter: ReturnType<typeof managedAdapter>,
  fake: ReturnType<typeof fakeClaudeQuery>,
) {
  const start = adapter.execute({
    type: 'session.start',
    harness: 'claude',
    prompt: 'hello',
    startTurn: false,
    workspace: { kind: 'main' },
  })
  await new Promise((resolve) => setImmediate(resolve))
  fake.emitInit({ apiKeySource: 'none' })
  return start
}

test('starts Claude after the selected Workspace is ready', async () => {
  const fake = fakeClaudeQuery()
  let releaseWorkspace: (() => void) | undefined
  let queryCalls = 0
  const adapter = createClaudeSessionAdapter({
    waitForWorkspaceReady: () =>
      new Promise<void>((resolve) => {
        releaseWorkspace = resolve
      }),
    resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: '/repository' }),
    createQuery: (params) => {
      queryCalls += 1
      return fake.createQuery(params)
    },
    readModelCatalog: async () => ({
      supportedPermissionModes: ['manual'],
      data: [
        {
          value: 'haiku',
          resolvedModel: 'claude-haiku-4-5',
          displayName: 'Haiku',
          description: '',
          supportedEffortLevels: ['low'],
        },
      ],
    }),
  })
  const outcome = adapter.execute({
    type: 'session.start',
    harness: 'claude',
    prompt: 'hello',
    workspace: { kind: 'main' },
  })
  await new Promise((resolve) => setImmediate(resolve))

  expect(queryCalls).toBe(0)
  releaseWorkspace?.()
  await new Promise((resolve) => setImmediate(resolve))

  expect(fake.sentPrompts()).toEqual([])
  fake.emitInit({ apiKeySource: 'none' })

  await expect(outcome).resolves.toMatchObject({
    kind: 'accepted',
    projection: {
      session: { harness: 'claude', nativeId: 'native-1' },
      workspace: { id: 'workspace-1' },
    },
  })
  expect(queryCalls).toBe(1)
  await new Promise((resolve) => setImmediate(resolve))
  expect(fake.sentPrompts()).toEqual(['hello'])
})

// The SDK only reports a Session's nativeId once it has read a first prompt off the stream
// (confirmed against the real @anthropic-ai/claude-agent-sdk: a query given a prompt iterable
// that never yields never emits even its "system"/"init" handshake), so `startTurn: false` can
// no longer withhold that first turn — only a caller resuming an already-identified Session can.
test('starting a Claude Session sends its first turn immediately, even when deferred', async () => {
  const fake = fakeClaudeQuery()
  const adapter = managedAdapter(fake)

  await startDeferredSession(adapter, fake)
  await new Promise((resolve) => setImmediate(resolve))

  expect(fake.sentPrompts()).toEqual(['hello'])
})

test('sends a resumed turn through the managed actor', async () => {
  const fake = fakeClaudeQuery()
  const adapter = managedAdapter(fake)
  const started = await startDeferredSession(adapter, fake)
  if (started.kind !== 'accepted') throw new Error('Claude Session did not start.')

  await adapter.resume({
    session: started.projection.session,
    workspace: { kind: 'main' },
    prompt: 'hello again',
    cwd: '/repository',
  })

  expect(fake.sentPrompts()).toEqual(['hello', 'hello again'])
})

// The real CLI refuses `--resume` for an id it cannot find and closes the stream after one error
// result, so the Session is never identified: the composer has to hear that the Turn did not land.
test('concurrent watched resumes send the first prompt once through one actor', async () => {
  const fake = fakeClaudeQuery()
  const adapter = managedAdapter(fake)
  const request = {
    session: { harness: 'claude' as const, nativeId: 'native-1' },
    workspace: { kind: 'main' as const },
    prompt: 'Continue the Session.',
    cwd: '/repository',
  }
  const first = adapter.resume(request)
  const second = adapter.resume(request)
  await new Promise((resolve) => setImmediate(resolve))
  fake.emitInit({ apiKeySource: 'none' })
  const outcomes = await Promise.all([first, second])
  await new Promise((resolve) => setImmediate(resolve))

  expect(outcomes.map((outcome) => outcome.kind)).toEqual(['accepted', 'accepted'])
  expect(fake.sentPrompts()).toEqual(['Continue the Session.'])
})

test('rejects a resume the Claude SDK never opens', async () => {
  const fake = fakeClaudeQuery()
  const adapter = managedAdapter(fake)

  const outcome = adapter.resume({
    session: { harness: 'claude', nativeId: 'never-resumable' },
    workspace: { kind: 'main' },
    prompt: 'Take this one over.',
    cwd: '/repository',
  })
  await new Promise((resolve) => setImmediate(resolve))
  fake.endStream()

  await expect(outcome).resolves.toMatchObject({ kind: 'rejected' })
  expect(adapter.roster()).toEqual([])
})

test('forwards the requested Turn setup to the Claude SDK query', async () => {
  const fake = fakeClaudeQuery()
  const adapter = managedAdapter(fake)
  const outcome = adapter.execute({
    type: 'session.start',
    harness: 'claude',
    prompt: 'hello',
    workspace: { kind: 'main' },
    setup: { model: 'haiku', effort: 'low', mode: 'manual' },
  })
  await new Promise((resolve) => setImmediate(resolve))
  fake.emitInit({ apiKeySource: 'none' })
  await outcome

  expect(fake.receivedOptions).toEqual({
    model: 'haiku',
    effort: 'low',
    permissionMode: 'default',
  })
})

test('notifies roster watchers when the SDK adds a live assistant message', async () => {
  const fake = fakeClaudeQuery()
  const adapter = managedAdapter(fake)
  let changes = 0
  const close = adapter.onRosterChanged(() => {
    changes += 1
  })
  const outcome = adapter.execute({
    type: 'session.start',
    harness: 'claude',
    prompt: 'hello',
    workspace: { kind: 'main' },
  })
  await new Promise((resolve) => setImmediate(resolve))
  fake.emitInit({ apiKeySource: 'none' })
  await outcome

  changes = 0
  fake.emitAssistant('Hello from Claude')
  await new Promise((resolve) => setImmediate(resolve))

  expect(changes).toBe(1)
  close()
})
