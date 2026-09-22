import { expect, test } from 'bun:test'
import { createActor } from 'xstate'
import {
  fakeClaudeQuery,
  managedSessionService,
} from '@/harnesses/claude/agent-sdk/claude-query-fixture'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'
import { projectionFrom } from '@/harnesses/claude/agent-sdk/claude-session-projection'

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

test('projects the managed Claude Session with its native ID and stable Workspace', async () => {
  const fake = fakeClaudeQuery()
  const actor = createActor(
    createClaudeSessionMachine({
      session: null,
      workspaceId: 'workspace-1',
      prompt: 'hello',
      cwd: '/repository',
      createQuery: fake.createQuery,
      renameSession: fake.renameSession,
      sessionService: managedSessionService,
    }),
    { input: undefined },
  ).start()

  fake.emitInit({ apiKeySource: 'none' })
  await flush()

  expect(projectionFrom(actor.getSnapshot(), 3)).toMatchObject({
    session: { harness: 'claude', nativeId: 'native-1' },
    posture: 'managed',
    revision: 3,
    workspace: { id: 'workspace-1' },
    status: 'idle',
  })
})
