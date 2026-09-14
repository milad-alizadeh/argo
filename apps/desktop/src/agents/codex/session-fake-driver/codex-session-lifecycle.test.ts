import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { CodexChannel } from '../drive/codex-channel.ts'
import { createCodexSessionDriver } from '../drive/codex-session-driver.ts'

test('follows a managed Session through Turn statuses and process exit', async () => {
  const requests: string[] = []
  const notifications: Array<(message: never) => void> = []
  const exits: Array<() => void> = []
  let turn = 0
  const channel: CodexChannel = {
    notify: () => {},
    async request(method, _params, decode) {
      requests.push(method)
      if (method === 'thread/start') return decode({ thread: { id: 'thread-1' } })
      if (method === 'turn/start') {
        turn += 1
        return decode({ turn: { id: `turn-${turn}`, status: 'inProgress' } })
      }
      return decode({})
    },
    onNotification: (listener) => notifications.push(listener as never),
    onExit: (listener) => exits.push(listener),
    close: () => {},
  }
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => new Date('2026-09-13T15:17:11.000Z'),
    openChannel: () => channel,
  })
  const sessionId = await driver.start({
    attachments: [],
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
  })
  const notify = notifications[0]
  assert.ok(notify)
  const notifyStatus = (status: { type: 'active'; activeFlags: string[] } | { type: 'idle' }) =>
    notify({
      method: 'thread/status/changed',
      params: { threadId: sessionId, status },
    } as never)
  const assertRosterStatus = (status: string) =>
    assert.deepEqual(
      driver.roster().map((session) => session.status),
      [status],
    )

  notifyStatus({ type: 'idle' })
  assertRosterStatus('idle')
  await driver.interrupt(sessionId)
  assert.equal(requests.includes('turn/interrupt'), false)

  await driver.send({
    sessionId,
    text: 'Inspect the next test.',
    setup: undefined,
    attachments: [],
  })
  notifyStatus({ type: 'active', activeFlags: [] })
  assertRosterStatus('running')

  notifyStatus({ type: 'idle' })
  assertRosterStatus('idle')

  exits[0]?.()
  assertRosterStatus('ended')
})
