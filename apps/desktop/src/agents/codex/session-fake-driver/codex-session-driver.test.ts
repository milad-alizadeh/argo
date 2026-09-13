import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { CodexChannel } from '../drive/codex-channel.ts'
import { CodexSessionDriverError, createCodexSessionDriver } from '../drive/codex-session-driver.ts'
import type { RequestParams } from '../drive/protocol.ts'

function fakeChannel(): CodexChannel & {
  calls: Array<{ method: string; params: unknown }>
  notifications: Array<(message: never) => void>
} {
  const calls: Array<{ method: string; params: unknown }> = []
  const notifications: Array<(message: never) => void> = []
  let turns = 0
  return {
    calls,
    notifications,
    notify: () => {},
    async request<Method extends keyof RequestParams, Result>(
      method: Method,
      params: RequestParams[Method],
      decode: (value: unknown) => Result,
    ) {
      calls.push({ method, params })
      if (method === 'thread/start') return decode({ thread: { id: 'thread-1' } })
      if (method === 'turn/start') {
        turns += 1
        return decode({ turn: { id: `turn-${turns}`, status: 'inProgress' } })
      }
      if (method === 'turn/interrupt') return decode({})
      return decode({})
    },
    onNotification: (listener) => notifications.push(listener as never),
    onExit: () => {},
    close: () => {},
  }
}

test('starts a Codex thread, sends the opening Turn and scrubs Codex credentials', async () => {
  const environments: NodeJS.ProcessEnv[] = []
  const channel = fakeChannel()
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    openChannel: (executable, options) => {
      assert.equal(executable, '/usr/local/bin/codex')
      environments.push(options.env)
      return channel
    },
  })

  const previous = { key: process.env.OPENAI_API_KEY, codex: process.env.CODEX_API_KEY }
  process.env.OPENAI_API_KEY = 'sk-test'
  process.env.CODEX_API_KEY = 'codex-test'
  try {
    const sessionId = await driver.start({
      cwd: '/projects/argo',
      prompt: 'Inspect the failing test.',
    })

    assert.equal(sessionId, 'thread-1')
    assert.equal('OPENAI_API_KEY' in (environments[0] ?? {}), false)
    assert.equal('CODEX_API_KEY' in (environments[0] ?? {}), false)
    assert.deepEqual(
      channel.calls.map(({ method }) => method),
      ['initialize', 'thread/start', 'turn/start'],
    )
    assert.deepEqual(
      driver.roster().map(({ id, posture, status }) => ({ id, posture, status })),
      [{ id: sessionId, posture: 'managed', status: 'running' }],
    )
  } finally {
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous.key
    if (previous.codex === undefined) delete process.env.CODEX_API_KEY
    else process.env.CODEX_API_KEY = previous.codex
  }
})

test('reports Codex as unavailable rather than throwing an unrelated error', async () => {
  const driver = createCodexSessionDriver({
    findExecutable: () => null,
    openChannel: () => fakeChannel(),
  })

  await assert.rejects(
    driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' }),
    (error) => error instanceof CodexSessionDriverError && error.code === 'codex-cli-unavailable',
  )
})

test('a Session whose opening Turn fails to start leaves no phantom Roster row', async () => {
  const channel: CodexChannel = {
    ...fakeChannel(),
    async request(method, _params, decode) {
      if (method === 'thread/start') return decode({ thread: { id: 'thread-1' } })
      if (method === 'turn/start') throw new Error('boom')
      return decode({})
    },
  }
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    openChannel: () => channel,
  })

  await assert.rejects(driver.start({ cwd: '/projects/argo', prompt: 'Inspect the test.' }))
  assert.deepEqual(driver.roster(), [])
})

test('marks a Session unknown once its Turn is reported failed', async () => {
  const channel = fakeChannel()
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    openChannel: () => channel,
  })

  const sessionId = await driver.start({ cwd: '/projects/argo', prompt: 'Inspect the test.' })
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
  const channel = fakeChannel()
  const driver = createCodexSessionDriver({
    findExecutable: () => '/usr/local/bin/codex',
    openChannel: () => channel,
  })
  const sessionId = await driver.start({ cwd: '/projects/argo', prompt: 'Write about ducks.' })
  channel.notifications[0]?.({
    method: 'item/agentMessage/delta',
    params: { threadId: sessionId, turnId: 'turn-1', itemId: 'msg-1', delta: 'Ducks' },
  } as never)

  await driver.send(sessionId, 'And geese?')
  assert.deepEqual(driver.liveMessages(sessionId), [{ id: 'msg-1', text: 'Ducks' }])

  await driver.send(sessionId, 'And swans?')
  assert.deepEqual(driver.liveMessages(sessionId), [])
})
