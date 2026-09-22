import { createActor } from 'xstate'
import { fakeClaudeQuery, managedSessionService } from './claude-query-fixture'
import { createClaudeSessionMachine } from './claude-session-machine'

export { fakeClaudeQuery, managedSessionService }

export function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

export async function startedClaudeActor(fake: ReturnType<typeof fakeClaudeQuery>) {
  const actor = createActor(
    createClaudeSessionMachine({
      session: { harness: 'claude', nativeId: 'native-1' },
      workspaceId: 'workspace-1',
      prompt: 'hello',
      cwd: '/repository',
      startedAt: '2026-09-22T00:00:00.000Z',
      createQuery: fake.createQuery,
      sessionService: managedSessionService,
    }),
    { input: undefined },
  ).start()
  fake.emitInit({ apiKeySource: 'none' })
  await flush()
  return actor
}
