import assert from 'node:assert/strict'
import { MessageChannel, Worker } from 'node:worker_threads'
import { test } from 'vitest'
import { createActor, fromCallback, fromPromise } from 'xstate'
import type {
  CodexChannel,
  CodexRequest,
  RequestParams,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexAppServerMachine,
  requestCodexAppServer,
} from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  confirmCodexAppServerReady,
  createCodexWorkerRequest,
  installCodexWorkerBridge,
  startWhenCodexReady,
  validateCodexWorkerRequest,
} from './session-sync-codex-bridge'

test('round trips a worker model/list read through the main-side request function', async () => {
  const { port1, port2 } = new MessageChannel()
  const workerRequest = createCodexWorkerRequest(port1)
  const request: CodexRequest = async (_method, params, parse) => parse({ models: [], params })
  const uninstall = installCodexWorkerBridge(port2, request)
  try {
    const result = await workerRequest('model/list', { limit: 20 }, (value) => value)
    assert.deepEqual(result, { models: [], params: { limit: 20 } })
  } finally {
    uninstall()
    port1.close()
    port2.close()
  }
})

function createTestCodexAppServer() {
  return createActor(
    codexAppServerMachine.provide({
      actors: {
        processActor: fromCallback(({ receive, sendBack }) => {
          receive((command) => {
            if (command.type === 'Dispatch')
              command.request.run({
                request: async <Method extends keyof RequestParams & string, Result>(
                  _method: Method,
                  _params: RequestParams[Method],
                  parse: (value: unknown) => Result,
                ): Promise<Result> => parse({ data: ['fixture-model'] }),
              } as unknown as CodexChannel)
          })
          sendBack({ type: 'Process ready', version: '0.147.0' })
        }),
        discoverExecutable: fromPromise(({ input }) =>
          Promise.resolve({
            type: 'Request',
            executable: 'codex',
            version: '0.147.0',
            run: input.run,
            reject: input.reject,
          }),
        ),
      },
    }),
    { input: { executable: 'codex' } },
  ).start()
}

test('serves a test-only worker request through the app-server request function', async () => {
  const worker = new Worker(
    `
      const { parentPort } = require('node:worker_threads')
      parentPort.on('message', (message) => {
        if (message.type === 'codex-response') process.stdout.write(JSON.stringify({ type: 'fixture-result', result: message.result, error: message.error }) + '\\n')
      })
      parentPort.postMessage({ type: 'codex-request', id: 'f2fbab42-0c4a-437d-a799-7dd03b6fbf8e', method: 'model/list', params: {} })
    `,
    { eval: true, stdout: true },
  )
  const appServer = createTestCodexAppServer()
  const uninstall = installCodexWorkerBridge(worker, requestCodexAppServer(appServer))
  const result = new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(
          new Error(`Worker fixture timed out: ${JSON.stringify(appServer.getSnapshot().value)}`),
        ),
      1_000,
    )
    worker.on('error', reject)
    worker.stdout?.on('data', (chunk: Buffer) => {
      const message = JSON.parse(chunk.toString('utf8')) as unknown
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'fixture-result'
      ) {
        clearTimeout(timeout)
        resolve(message)
      }
    })
  })
  try {
    assert.deepEqual(await result, {
      type: 'fixture-result',
      result: { data: ['fixture-model'] },
    })
  } finally {
    uninstall()
    await worker.terminate()
    appServer.stop()
  }
})

test('rejects unknown methods and malformed worker envelopes', () => {
  assert.equal(
    validateCodexWorkerRequest({
      type: 'codex-request',
      id: 'bad',
      method: 'thread/read',
      params: {},
    }),
    null,
  )
  assert.equal(
    validateCodexWorkerRequest({
      type: 'codex-request',
      id: 'bad',
      method: 'model/list',
      params: {},
      extra: true,
    }),
    null,
  )
})

test('returns an error for an invalid request with a usable ID', async () => {
  const { port1, port2 } = new MessageChannel()
  const uninstall = installCodexWorkerBridge(port2, async () => {
    throw new Error('invalid request must not reach app-server')
  })
  const response = new Promise<unknown>((resolve) => port1.once('message', resolve))
  port1.postMessage({
    type: 'codex-request',
    id: 'f2fbab42-0c4a-437d-a799-7dd03b6fbf8e',
    method: 'thread/read',
    params: {},
  })
  try {
    assert.deepEqual(await response, {
      type: 'codex-response',
      id: 'f2fbab42-0c4a-437d-a799-7dd03b6fbf8e',
      error: 'Invalid Codex Session sync worker request.',
    })
    assert.equal(uninstall.invalidMessageCount(), 1)
  } finally {
    uninstall()
    port1.close()
    port2.close()
  }
})

test('proves app-server readiness by awaiting its model/list response', async () => {
  let requested = false
  const request: CodexRequest = async (method, _params, parse) => {
    assert.equal(method, 'model/list')
    requested = true
    return parse({ data: [] })
  }
  await confirmCodexAppServerReady(request)
  assert.equal(requested, true)
  await assert.rejects(
    confirmCodexAppServerReady(async () => {
      throw new Error('offline')
    }),
    /offline/,
  )
})

test('does not start after readiness fails or the supervisor cancels the check', async () => {
  let startCount = 0
  let failure: unknown
  await new Promise<void>((resolve) => {
    startWhenCodexReady(
      async () => {
        throw new Error('offline')
      },
      {
        start: () => startCount++,
        fail: (error) => {
          failure = error
          resolve()
        },
      },
    )
  })
  assert.equal(startCount, 0)
  assert.match(String(failure), /offline/)

  let release: (() => void) | undefined
  const pendingRequest: CodexRequest = (_method, _params, parse) =>
    new Promise((resolve) => {
      release = () => resolve(parse({ data: [] }))
    })
  const cancel = startWhenCodexReady(pendingRequest, {
    start: () => startCount++,
    fail: () => assert.fail('cancelled readiness must not report a late failure'),
  })
  cancel()
  release?.()
  await new Promise<void>((resolve) => setTimeout(resolve, 10))
  assert.equal(startCount, 0)
})

test('fails readiness once and ignores a reply after the deadline', async () => {
  let release: (() => void) | undefined
  let starts = 0
  const failures: unknown[] = []
  const cancel = startWhenCodexReady(
    (_method, _params, parse) =>
      new Promise((resolve) => {
        release = () => resolve(parse({ data: [] }))
      }),
    {
      start: () => starts++,
      fail: (error) => failures.push(error),
      timeoutMs: 1,
    },
  )
  await new Promise((resolve) => setTimeout(resolve, 5))
  release?.()
  await new Promise<void>((resolve) => setImmediate(resolve))
  cancel()
  assert.equal(starts, 0)
  assert.equal(failures.length, 1)
  assert.match(String(failures[0]), /readiness check timed out/)
})

test('settles pending reads when the bridge closes', async () => {
  const { port1, port2 } = new MessageChannel()
  const request = createCodexWorkerRequest(port1)
  const pending = request('model/list', {}, (value) => value)
  port1.close()
  await assert.rejects(pending, /bridge closed/)
  port2.close()
})

test('rejects a malformed reply that matches an outstanding request', async () => {
  const { port1, port2 } = new MessageChannel()
  const request = createCodexWorkerRequest(port1)
  const pending = request('model/list', {}, (value) => value)
  const sent = await new Promise<{ id: string }>((resolve) => port2.once('message', resolve))
  port2.postMessage({
    type: 'codex-response',
    id: sent.id,
    result: { data: [] },
    error: null,
  })
  await assert.rejects(pending, /Invalid Codex Session sync bridge response/)
  assert.equal(request.invalidMessageCount(), 1)
  port1.close()
  port2.close()
})

test('counts malformed bridge messages without usable IDs', async () => {
  const { port1, port2 } = new MessageChannel()
  const workerRequest = createCodexWorkerRequest(port1)
  const uninstall = installCodexWorkerBridge(port2, async () => {
    throw new Error('malformed request must not reach app-server')
  })
  port2.postMessage({ type: 'codex-response', result: [] })
  port1.postMessage({ type: 'codex-request', method: 'model/list', params: {} })
  await new Promise<void>((resolve) => setTimeout(resolve, 10))
  assert.equal(workerRequest.invalidMessageCount(), 1)
  assert.equal(uninstall.invalidMessageCount(), 1)
  uninstall()
  port1.close()
  port2.close()
})

test('leaves generic Session sync messages to the worker handler', async () => {
  const { port1, port2 } = new MessageChannel()
  const uninstall = installCodexWorkerBridge(port2, async () => {
    throw new Error('generic messages must not reach the Codex server')
  })
  port1.postMessage({ type: 'status', status: { phase: 'fetching' } })
  port1.postMessage({ type: 'committed' })
  port1.postMessage({ type: 'finished', outcome: 'ready' })
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(uninstall.invalidMessageCount(), 0)
  uninstall()
  port1.close()
  port2.close()
})

test('ignores an app-server reply after the worker bridge closes', async () => {
  const { port1, port2 } = new MessageChannel()
  let release: ((value: unknown) => void) | undefined
  const request = createCodexWorkerRequest(port1, 20)
  const delayedRequest: CodexRequest = (_method, _params, parse) =>
    new Promise((resolve) => {
      release = (value) => resolve(parse(value))
    })
  const uninstall = installCodexWorkerBridge(port2, delayedRequest)
  const pending = request('model/list', {}, (value) => value)
  const sent = await new Promise<unknown>((resolve) => port2.once('message', resolve))
  let replies = 0
  port1.on('message', () => replies++)
  uninstall()
  release?.({ data: [] })
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(replies, 0)
  assert.ok(validateCodexWorkerRequest(sent))
  port1.close()
  await assert.rejects(pending, /bridge closed/)
  port2.close()
})
