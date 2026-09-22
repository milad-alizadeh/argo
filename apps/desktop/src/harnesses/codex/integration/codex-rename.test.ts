import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RequestParams } from '@/harnesses/codex/drive/protocol'
import { createCodexSessionDriver } from '@/harnesses/codex/drive/session/codex-session-driver'
import type { CodexChannel } from '@/harnesses/codex/drive/supervision/codex-channel'

test('renames a Codex Session through thread/name/set and accepts its native notification', async () => {
  const calls: Array<{ method: string; params: unknown }> = []
  const listeners: Array<(message: never) => void> = []
  const channel: CodexChannel = {
    notify: () => {},
    async request<Method extends keyof RequestParams, Result>(
      method: Method,
      params: RequestParams[Method],
      decode: (value: unknown) => Result,
    ) {
      calls.push({ method, params })
      if (method === 'thread/start') return decode({ thread: { id: 'thread-1' } })
      if (method === 'turn/start') return decode({ turn: { id: 'turn-1', status: 'inProgress' } })
      if (method === 'thread/name/set') {
        listeners[0]?.({
          method: 'thread/name/updated',
          params: { threadId: params.threadId, threadName: 'Confirmed by Codex' },
        } as never)
      }
      return decode({})
    },
    onNotification: (listener) => listeners.push(listener as never),
    onExit: () => {},
    close: () => {},
  }
  const driver = createCodexSessionDriver({
    findExecutable: () => 'codex',
    now: () => new Date(),
    resumeTarget: async () => null,
    openChannel: () => channel,
  })
  const sessionId = await driver.start({
    attachments: [],
    cwd: '/projects/argo',
    prompt: 'Inspect the test.',
  })
  assert.equal(await driver.rename(sessionId, 'Keep the roster stable'), 'Confirmed by Codex')
  assert.deepEqual(calls.at(-1), {
    method: 'thread/name/set',
    params: { threadId: sessionId, name: 'Keep the roster stable' },
  })
  assert.deepEqual(
    driver.roster().map(({ title }) => title),
    [{ text: 'Confirmed by Codex', source: 'custom' }],
  )
})
