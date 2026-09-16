import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockChannel, mockChannelFailing } from '../../../../mocks/cli/codex/mock-channel.ts'
import type { CodexChannel } from '../drive/codex-channel.ts'
import { CodexSessionDriverError, createCodexSessionDriver } from '../drive/codex-session-driver.ts'

const STARTED_AT = new Date('2026-09-13T15:17:11.000Z')

function codexDriver(channel: CodexChannel) {
  return createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => channel,
  })
}

async function startedSession(channel: CodexChannel) {
  const driver = codexDriver(channel)
  const sessionId = await driver.start({
    attachments: [],
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
  })
  const compactionStartedAt = () => driver.roster().map((row) => row.compactionStartedAt)
  return { driver, sessionId, compactionStartedAt }
}

function reportCompaction(
  channel: ReturnType<typeof mockChannel>,
  threadId: string,
  method: 'item/started' | 'item/completed',
) {
  channel.notifications[0]?.({
    method,
    params: { threadId, turnId: 'turn-1', item: { id: 'compaction-1', type: 'contextCompaction' } },
  } as never)
}

test('compacts a Codex Session and clears its compaction once Codex reports the item complete', async () => {
  const channel = mockChannel()
  const { driver, sessionId, compactionStartedAt } = await startedSession(channel)

  await driver.compact(sessionId)
  reportCompaction(channel, sessionId, 'item/started')
  const during = compactionStartedAt()
  reportCompaction(channel, sessionId, 'item/completed')

  assert.deepEqual(channel.calls.at(-1), {
    method: 'thread/compact/start',
    params: { threadId: sessionId },
  })
  assert.deepEqual([during, compactionStartedAt()], [[STARTED_AT.toISOString()], [null]])
})

test('shows a compaction Codex starts on its own until Codex reports it complete', async () => {
  const channel = mockChannel()
  const { sessionId, compactionStartedAt } = await startedSession(channel)

  reportCompaction(channel, sessionId, 'item/started')
  const during = compactionStartedAt()
  reportCompaction(channel, sessionId, 'item/completed')

  assert.deepEqual([during, compactionStartedAt()], [[STARTED_AT.toISOString()], [null]])
})

test('leaves a Codex Session usable when its compact request fails', async () => {
  const channel = mockChannelFailing('thread/compact/start')
  const { driver, sessionId, compactionStartedAt } = await startedSession(channel)

  await assert.rejects(driver.compact(sessionId))

  assert.deepEqual(compactionStartedAt(), [null])
})

test('refuses to compact a Session Argo no longer holds', async () => {
  const driver = codexDriver(mockChannel())

  await assert.rejects(
    driver.compact('unknown-session'),
    (error) => error instanceof CodexSessionDriverError && error.code === 'not-drivable',
  )
})
