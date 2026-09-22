import { expect, test } from 'bun:test'
import { fakeClaudeQuery, startedClaudeActor } from './claude-session-test-support'

test('projects SDK assistant text for the live Session feed', async () => {
  const fake = fakeClaudeQuery()
  const actor = await startedClaudeActor(fake)
  fake.emitAssistant('Hello from Claude')
  await new Promise((resolve) => setImmediate(resolve))

  expect(actor.getSnapshot().context.liveMessages).toEqual([
    { id: '00000000-0000-0000-0000-000000000002', text: 'Hello from Claude' },
  ])
})
