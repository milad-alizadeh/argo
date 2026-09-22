import { expect, test } from 'bun:test'
import {
  fakeClaudeQuery,
  managedSessionService,
} from '@/harnesses/claude/agent-sdk/claude-query-fixture'
import { createClaudeSessionAdapter } from '@/harnesses/claude/agent-sdk/claude-session-adapter'

test('starts Claude after the selected Workspace is ready', async () => {
  const fake = fakeClaudeQuery()
  let releaseWorkspace: (() => void) | undefined
  let queryCalls = 0
  const adapter = createClaudeSessionAdapter({
    sessionService: managedSessionService,
    waitForWorkspaceReady: () =>
      new Promise<void>((resolve) => {
        releaseWorkspace = resolve
      }),
    resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: '/repository' }),
    createQuery: (params) => {
      queryCalls += 1
      return fake.createQuery(params)
    },
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
  expect(fake.sentPrompts()).toEqual(['hello'])
})

test('notifies roster watchers when the SDK adds a live assistant message', async () => {
  const fake = fakeClaudeQuery()
  const adapter = createClaudeSessionAdapter({
    sessionService: managedSessionService,
    waitForWorkspaceReady: async () => {},
    resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: '/repository' }),
    createQuery: fake.createQuery,
  })
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
