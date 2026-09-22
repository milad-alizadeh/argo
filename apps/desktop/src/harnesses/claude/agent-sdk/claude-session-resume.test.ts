// A resume names the Session up front, so its identity proves nothing about whether the channel
// opened. The real CLI refuses `--resume` for an id it cannot find — `claude -p --resume` answers
// "Provided value is not a UUID and does not match any session title" — and then closes the stream
// after that one error result, never emitting the "system"/"init" handshake.
import { expect, test } from 'bun:test'
import { createActor } from 'xstate'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'
import {
  fakeClaudeQuery,
  flush,
  managedSessionService,
} from '@/harnesses/claude/agent-sdk/claude-session-test-support'

function resumingActor(fake: ReturnType<typeof fakeClaudeQuery>) {
  return createActor(
    createClaudeSessionMachine({
      session: { harness: 'claude', nativeId: 'never-resumable' },
      workspaceId: 'workspace-1',
      prompt: 'Take this one over.',
      cwd: '/repository',
      startedAt: '2026-09-22T00:00:00.000Z',
      createQuery: fake.createQuery,
      sessionService: managedSessionService,
    }),
    { input: undefined },
  ).start()
}

test('becomes unavailable when the SDK stream ends before the Session is identified', async () => {
  const fake = fakeClaudeQuery()
  const actor = resumingActor(fake)

  fake.endStream()
  await flush()

  expect(actor.getSnapshot().value).toBe('Unavailable')
  expect(actor.getSnapshot().context.sourceHealth).toBe('unavailable')
})
