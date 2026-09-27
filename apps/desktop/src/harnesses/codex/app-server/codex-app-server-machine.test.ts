import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createActor, waitFor } from 'xstate'
import type { CodexAppServerClient } from './codex-app-server-client'
import { codexAppServerMachine, requestCodexAppServer } from './codex-app-server-machine'

test('keeps the actor request API compatible while delegating ownership to the client', async () => {
  const calls: string[] = []
  let shutdown = false
  const client: CodexAppServerClient = {
    onNotification: () => () => {},
    request: async (method, _params, parse) => {
      calls.push(method)
      return parse({ data: [] })
    },
    respond: () => {},
    shutdown: () => {
      shutdown = true
    },
  }
  const actor = createActor(codexAppServerMachine, {
    input: {
      client,
    },
  }).start()

  assert.deepEqual(await requestCodexAppServer(actor)('model/list', {}, (value) => value), {
    data: [],
  })
  assert.deepEqual(calls, ['model/list'])

  actor.send({ type: 'Shutdown' })
  await waitFor(actor, (snapshot) => snapshot.matches('Closed'))
  assert.equal(shutdown, true)
  await assert.rejects(
    requestCodexAppServer(actor)('model/list', {}, (value) => value),
    /Codex app-server is closed/,
  )
})
