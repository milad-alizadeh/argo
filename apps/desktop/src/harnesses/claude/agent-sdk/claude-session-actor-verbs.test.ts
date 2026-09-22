import { describe, expect, test } from 'bun:test'
import { createActor } from 'xstate'
import { fakeClaudeQuery } from '@/harnesses/claude/agent-sdk/claude-query-fixture'
import { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

async function startedActor(fake: ReturnType<typeof fakeClaudeQuery>) {
  const machine = createClaudeSessionMachine({
    session: { harness: 'claude', nativeId: 'native-1' },
    prompt: 'hello',
    cwd: '/repository',
    createQuery: fake.createQuery,
    renameSession: fake.renameSession,
  })
  const actor = createActor(machine, {
    input: { session: { harness: 'claude', nativeId: 'native-1' } },
  }).start()
  fake.emitInit({ apiKeySource: 'none' })
  await flush()
  return actor
}

describe('claude session actor verb set', () => {
  test('streams a steer command into the SDK alongside the running turn', async () => {
    const fake = fakeClaudeQuery()
    const actor = await startedActor(fake)

    actor.send({ type: 'Steer', prompt: 'steered message' })
    await flush()

    expect(fake.sentPrompts()).toEqual(['hello', 'steered message'])
  })

  test('resolves a pending tool approval when the user approves', async () => {
    const fake = fakeClaudeQuery()
    const actor = await startedActor(fake)

    const pending = fake.requestApproval('tool-use-1', 'Bash')
    actor.send({ type: 'Decide', approvalId: 'tool-use-1', decision: 'approve' })

    expect(await pending).toEqual({ behavior: 'allow' })
  })

  test('resolves a pending tool approval with a denial message when the user rejects', async () => {
    const fake = fakeClaudeQuery()
    const actor = await startedActor(fake)

    const pending = fake.requestApproval('tool-use-2', 'Bash')
    actor.send({ type: 'Decide', approvalId: 'tool-use-2', decision: 'reject' })

    expect(await pending).toEqual({ behavior: 'deny', message: 'Rejected by user' })
  })

  test('resolves a pending elicitation dialog when the user answers', async () => {
    const fake = fakeClaudeQuery()
    const actor = await startedActor(fake)

    const pending = fake.requestDialog('dialog-1')
    actor.send({ type: 'Answer', questionId: 'dialog-1', answer: 'yes' })

    expect(await pending).toEqual({ behavior: 'completed', result: 'yes' })
  })

  test('cancels a pending approval when the session closes before it is decided', async () => {
    const fake = fakeClaudeQuery()
    const actor = await startedActor(fake)

    const pending = fake.requestApproval('tool-use-3', 'Bash')
    actor.stop()

    expect(await pending).toBeNull()
  })

  test('renames the underlying SDK session', async () => {
    const fake = fakeClaudeQuery()
    const actor = await startedActor(fake)

    actor.send({ type: 'Rename', title: 'New title' })
    await flush()

    expect(fake.renamedTo).toEqual(['New title'])
  })
})
