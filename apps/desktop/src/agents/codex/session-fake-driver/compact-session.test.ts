import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { CodexChannel } from '../drive/codex-channel.ts'
import { CodexSessionDriverError, createCodexSessionDriver } from '../drive/codex-session-driver.ts'
import { fakeChannel } from './fake-channel.ts'

const STARTED_AT = new Date('2026-09-13T15:17:11.000Z')

test('compacts a Codex Session and clears its compaction once Codex reports the item complete', async () => {
  const channel = fakeChannel()
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => channel,
  })
  const sessionId = await driver.start({
    attachments: [],
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
  })

  await driver.compact(sessionId)

  assert.deepEqual(channel.calls.at(-1), {
    method: 'thread/compact/start',
    params: { threadId: sessionId },
  })
  assert.deepEqual(
    driver.roster().map(({ id, compactionStartedAt }) => ({ id, compactionStartedAt })),
    [{ id: sessionId, compactionStartedAt: STARTED_AT.toISOString() }],
  )

  channel.notifications[0]?.({
    method: 'item/completed',
    params: {
      threadId: sessionId,
      turnId: 'compact-turn-1',
      completedAtMs: 1,
      item: { id: 'compaction-1', type: 'contextCompaction' },
    },
  } as never)

  assert.deepEqual(
    driver.roster().map(({ id, compactionStartedAt }) => ({ id, compactionStartedAt })),
    [{ id: sessionId, compactionStartedAt: null }],
  )
})

test('leaves a Codex Session usable when its compact request fails', async () => {
  const channel: CodexChannel = {
    ...fakeChannel(),
    async request(method, _params, decode) {
      if (method === 'thread/start') return decode({ thread: { id: 'thread-1' } })
      if (method === 'turn/start') return decode({ turn: { id: 'turn-1', status: 'inProgress' } })
      if (method === 'thread/compact/start') throw new Error('boom')
      return decode({})
    },
  }
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => channel,
  })
  const sessionId = await driver.start({
    attachments: [],
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
  })

  await assert.rejects(driver.compact(sessionId))

  assert.deepEqual(
    driver.roster().map(({ id, compactionStartedAt }) => ({ id, compactionStartedAt })),
    [{ id: sessionId, compactionStartedAt: null }],
  )
})

test('refuses to compact a Session Argo no longer holds', async () => {
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => fakeChannel(),
  })

  await assert.rejects(
    driver.compact('unknown-session'),
    (error) => error instanceof CodexSessionDriverError && error.code === 'not-drivable',
  )
})
