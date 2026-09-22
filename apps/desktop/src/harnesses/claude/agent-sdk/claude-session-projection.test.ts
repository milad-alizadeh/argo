import { expect, test } from 'bun:test'
import { projectionFrom } from './claude-session-projection'
import { fakeClaudeQuery, startedClaudeActor } from './claude-session-test-support'

test('projects the managed Claude Session with its native ID and stable Workspace', async () => {
  const fake = fakeClaudeQuery()
  const actor = await startedClaudeActor(fake)

  expect(projectionFrom(actor.getSnapshot(), 3)).toMatchObject({
    session: { harness: 'claude', nativeId: 'native-1' },
    posture: 'managed',
    revision: 3,
    workspace: { id: 'workspace-1' },
    status: 'running',
  })
})
