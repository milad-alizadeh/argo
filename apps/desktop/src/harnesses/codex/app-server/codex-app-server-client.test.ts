import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  type CodexChannel,
  createCodexAppServerClient,
  type WireMessage,
} from './codex-app-server-client'

test('owns requests through one process and closes it on shutdown', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-client-'))
  const executable = path.join(directory, 'codex')
  const server = path.join(directory, 'server.mjs')
  const starts = path.join(directory, 'starts')
  const closed = path.join(directory, 'closed')
  const recordedCatalog = await readFile(
    fileURLToPath(
      new URL(
        '../../../../mocks/cli/codex/fixtures/model-list-codex-0.147.0.json',
        import.meta.url,
      ),
    ),
    'utf8',
  )
  const script = `import { appendFileSync, writeFileSync } from 'node:fs'; import { createInterface } from 'node:readline';
appendFileSync(${JSON.stringify(starts)}, 'started\\n');
const catalog = JSON.parse(${JSON.stringify(recordedCatalog)});
process.on('SIGTERM', () => { writeFileSync(${JSON.stringify(closed)}, 'closed'); process.exit(0); });
createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  const result = request.method === 'model/list' ? catalog : {};
  process.stdout.write(JSON.stringify({ id: request.id, result }) + '\\n');
});`
  await writeFile(server, script)
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'codex 0.147.0'; exit 0; fi\nexec "${process.execPath}" "${server}"\n`,
  )
  await chmod(executable, 0o755)
  const client = createCodexAppServerClient({
    resolveExecutable: async () => ({
      executable,
      version: 'codex 0.147.0',
    }),
  })
  try {
    await client.request('model/list', {}, (value) => value)
    await client.request('model/list', {}, (value) => value)
    assert.equal((await readFile(starts, 'utf8')).trim().split('\n').length, 1)

    client.shutdown()
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(await readFile(closed, 'utf8'), 'closed')
  } finally {
    client.shutdown()
    await rm(directory, { recursive: true, force: true })
  }
})

test('cancels an unanswered request when the client shuts down', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-client-cancel-'))
  const executable = path.join(directory, 'codex')
  const server = path.join(directory, 'server.mjs')
  await writeFile(server, "process.stdin.resume(); process.on('SIGTERM', () => process.exit(0));")
  await writeFile(executable, `#!/bin/sh\nexec "${process.execPath}" "${server}"\n`)
  await chmod(executable, 0o755)
  const client = createCodexAppServerClient({
    resolveExecutable: async () => ({ executable, version: 'codex 0.147.0' }),
  })
  try {
    const request = client.request('model/list', {}, (value) => value)
    await new Promise((resolve) => setTimeout(resolve, 20))
    client.shutdown()
    await assert.rejects(request, /closed before this request settled/)
  } finally {
    client.shutdown()
    await rm(directory, { recursive: true, force: true })
  }
})

test('cancels executable discovery immediately when the client shuts down', {
  timeout: 100,
}, async () => {
  const client = createCodexAppServerClient({
    resolveExecutable: () => new Promise(() => {}),
  })
  const request = client.request('model/list', {}, (value) => value)
  client.shutdown()
  await assert.rejects(request, /Codex app-server is closed/)
})

test('forwards server notifications and responses through the client API', async () => {
  let receive: ((message: WireMessage) => boolean | undefined) | undefined
  const responses: Array<{ id: string | number; result: unknown }> = []
  const channel: CodexChannel = {
    invalidMessageCount: () => 0,
    notify: () => {},
    request: async (_method, _params, parse) => parse({}),
    respond: (id, result) => responses.push({ id, result }),
    onNotification: (listener) => {
      receive = listener
    },
    onExit: () => {},
    close: () => {},
  }
  const client = createCodexAppServerClient({
    resolveExecutable: async () => ({ executable: 'codex', version: 'codex 0.147.0' }),
    openChannel: () => channel,
  })
  const notifications: WireMessage[] = []
  client.onNotification((message) => {
    notifications.push(message)
    return true
  })

  await client.request('model/list', {}, (value) => value)
  assert.equal(
    receive?.({ id: 7, method: 'item/tool/requestUserInput', params: { prompt: 'Choose' } }),
    true,
  )
  client.respond(7, { answers: ['A'] })

  assert.deepEqual(notifications, [
    { id: 7, method: 'item/tool/requestUserInput', params: { prompt: 'Choose' } },
  ])
  assert.deepEqual(responses, [{ id: 7, result: { answers: ['A'] } }])
  client.shutdown()
})

test('enables Turn pages only for the verified Codex 0.157.0 protocol', async () => {
  const handshakes: boolean[] = []
  const methods: string[] = []
  const channel: CodexChannel = {
    invalidMessageCount: () => 0,
    notify: () => {},
    request: async (method, params, parse) => {
      methods.push(method)
      if (method === 'initialize' && 'capabilities' in params)
        handshakes.push(params.capabilities.experimentalApi)
      return parse(
        method === 'thread/turns/list' ? { data: [], nextCursor: null, backwardsCursor: null } : {},
      )
    },
    respond: () => {},
    onNotification: () => {},
    onExit: () => {},
    close: () => {},
  }
  for (const version of ['codex-cli 0.157.0', 'codex-cli 0.147.0']) {
    const client = createCodexAppServerClient({
      resolveExecutable: async () => ({ executable: 'codex', version }),
      openChannel: () => channel,
    })
    try {
      const page = client.request(
        'thread/turns/list',
        {
          threadId: 'thread-1',
          cursor: null,
          limit: 1,
          sortDirection: 'desc',
          itemsView: 'full',
        },
        (value) => value,
      )
      if (version === 'codex-cli 0.157.0') await page
      else await assert.rejects(page, /not available for this Codex version/)
    } finally {
      client.shutdown()
    }
  }
  assert.deepEqual(handshakes, [true, false])
  assert.deepEqual(
    methods.filter((method) => method === 'thread/turns/list'),
    ['thread/turns/list'],
  )
})
