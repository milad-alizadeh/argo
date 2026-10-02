import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { MOCK_CODEX_VERSION } from '@/mocks/cli/codex/mock-codex-cli'
import { recordedCodexModels } from '@/mocks/recordings/codex-app-server'
import {
  type CodexChannel,
  CodexUnavailableError,
  createCodexAppServerClient,
  resolveCodexExecutable,
  type WireMessage,
} from './codex-app-server-client'

test('owns requests through one process and closes it on shutdown', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-client-'))
  const executable = path.join(directory, 'codex')
  const server = path.join(directory, 'server.mjs')
  const starts = path.join(directory, 'starts')
  const closed = path.join(directory, 'closed')
  const recordedCatalog = JSON.stringify(recordedCodexModels)
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
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'codex-cli ${MOCK_CODEX_VERSION}'; exit 0; fi\nexec "${process.execPath}" "${server}"\n`,
  )
  await chmod(executable, 0o755)
  const client = createCodexAppServerClient({
    resolveExecutable: async () => ({
      executable,
      version: `codex-cli ${MOCK_CODEX_VERSION}`,
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

async function countingCodex() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-client-version-'))
  const executable = path.join(directory, 'codex')
  const server = path.join(directory, 'server.mjs')
  const starts = path.join(directory, 'starts')
  const versions = path.join(directory, 'versions')
  await writeFile(
    server,
    `import { appendFileSync } from 'node:fs'; import { createInterface } from 'node:readline';
appendFileSync(${JSON.stringify(starts)}, 'started\\n');
createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.id !== undefined) process.stdout.write(JSON.stringify({ id: request.id, result: {} }) + '\\n');
});`,
  )
  const writeVersion = async (version: string) => {
    await writeFile(
      executable,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then echo version >> "${versions}"; echo 'codex-cli ${version}'; exit 0; fi\nexec "${process.execPath}" "${server}"\n`,
    )
    await chmod(executable, 0o755)
  }
  await writeVersion(MOCK_CODEX_VERSION)
  const lineCount = async (file: string) => (await readFile(file, 'utf8')).trim().split('\n').length
  const client = createCodexAppServerClient({
    resolveExecutable: (signal) => resolveCodexExecutable(signal, executable),
  })
  return {
    client,
    writeVersion,
    versionChecks: () => lineCount(versions),
    serverStarts: () => lineCount(starts),
    dispose: async () => {
      client.shutdown()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test('checks the executable version once across sequential requests on one connection', async () => {
  const codex = await countingCodex()
  try {
    for (let index = 0; index < 5; index += 1) {
      await codex.client.request('thread/list', {}, (value) => value)
    }
    assert.equal(await codex.versionChecks(), 1)
    assert.equal(await codex.serverStarts(), 1)
  } finally {
    await codex.dispose()
  }
})

test('checks the executable version once across concurrent requests', async () => {
  const codex = await countingCodex()
  try {
    await Promise.all(
      Array.from({ length: 20 }, () => codex.client.request('thread/list', {}, (value) => value)),
    )
    await Promise.all(
      Array.from({ length: 20 }, () => codex.client.request('thread/list', {}, (value) => value)),
    )
    assert.equal(await codex.versionChecks(), 1)
    assert.equal(await codex.serverStarts(), 1)
  } finally {
    await codex.dispose()
  }
})

test('keeps the app-server when the executable file is rewritten at the same version', async () => {
  const codex = await countingCodex()
  try {
    await codex.client.request('thread/list', {}, (value) => value)
    await codex.writeVersion(MOCK_CODEX_VERSION)
    await codex.client.request('thread/list', {}, (value) => value)
    await codex.client.request('thread/list', {}, (value) => value)
    assert.equal(await codex.versionChecks(), 2)
    assert.equal(await codex.serverStarts(), 1)
  } finally {
    await codex.dispose()
  }
})

test('restarts the app-server when the executable file changes to a new version', async () => {
  const codex = await countingCodex()
  try {
    await codex.client.request('thread/list', {}, (value) => value)
    await codex.writeVersion(`${MOCK_CODEX_VERSION}-next`)
    await codex.client.request('thread/list', {}, (value) => value)
    assert.equal(await codex.versionChecks(), 2)
    assert.equal(await codex.serverStarts(), 2)
  } finally {
    await codex.dispose()
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
    resolveExecutable: async () => ({ executable, version: `codex-cli ${MOCK_CODEX_VERSION}` }),
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

test('names a machine without Codex in the request failure', async () => {
  const client = createCodexAppServerClient({ resolveExecutable: async () => null })
  try {
    await assert.rejects(
      client.request('thread/list', {}, (value) => value),
      CodexUnavailableError,
    )
  } finally {
    client.shutdown()
  }
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
    resolveExecutable: async () => ({
      executable: 'codex',
      version: `codex-cli ${MOCK_CODEX_VERSION}`,
    }),
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
