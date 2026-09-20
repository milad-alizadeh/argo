// The Codex session driver's post-start Turn tracking, split from codex-session-driver.test.ts to
// stay under the file's line cap: Roster status once a Turn fails, and live message retention
// across a quick reply.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCodexSessionDriver } from '@/harnesses/codex/drive/codex-session-driver.ts'
import { mockChannel } from '../../../../mocks/harness/codex/mock-channel.ts'

const STARTED_AT = new Date('2026-09-13T15:17:11.000Z')

async function startedSession(prompt: string) {
  const channel = mockChannel()
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    now: () => STARTED_AT,
    resumeTarget: async () => null,
    openChannel: () => channel,
  })
  const sessionId = await driver.start({ attachments: [], cwd: '/projects/argo', prompt })
  return { channel, driver, sessionId }
}

test('marks a Session unknown once its Turn is reported failed', async () => {
  const { channel, driver, sessionId } = await startedSession('Inspect the test.')
  const notify = channel.notifications[0]
  assert.ok(notify)
  notify({
    method: 'turn/completed',
    params: { threadId: sessionId, turn: { id: 'turn-1', status: 'failed', error: 'boom' } },
  } as never)

  assert.deepEqual(
    driver.roster().map(({ id, status }) => ({ id, status })),
    [{ id: sessionId, status: 'unknown' }],
  )
})

test('keeps the streamed messages of the last Turn through a quick reply, and forgets older ones', async () => {
  const { channel, driver, sessionId } = await startedSession('Write about ducks.')
  channel.notifications[0]?.({
    method: 'item/agentMessage/delta',
    params: { threadId: sessionId, turnId: 'turn-1', itemId: 'msg-1', delta: 'Ducks' },
  } as never)

  await driver.send({ sessionId, text: 'And geese?', setup: undefined, attachments: [] })
  assert.deepEqual(driver.liveMessages(sessionId), [{ id: 'msg-1', text: 'Ducks' }])

  await driver.send({ sessionId, text: 'And swans?', setup: undefined, attachments: [] })
  assert.deepEqual(driver.liveMessages(sessionId), [])
})
