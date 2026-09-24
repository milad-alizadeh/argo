import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { waitFor } from 'xstate'
import { codexModelCatalogFixture } from '../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import type { CodexChannel } from './codex-app-server-machine'
import { createCodexAppServer, processExitIsCurrent } from './codex-app-server-machine'

test('ignores the exit of a superseded app-server channel', () => {
  const oldChannel = {} as CodexChannel
  const replacement = {} as CodexChannel

  assert.equal(processExitIsCurrent(oldChannel, replacement), false)
  assert.equal(processExitIsCurrent(replacement, replacement), true)
})

test('owns model/list and closes its child process on shutdown', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-catalog-'))
  const executable = path.join(directory, 'codex')
  const server = path.join(directory, 'server.mjs')
  const closed = path.join(directory, 'closed')
  const script = `import { createInterface } from 'node:readline'; import { writeFileSync } from 'node:fs';
const catalog = ${JSON.stringify(codexModelCatalogFixture())};
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
  const runtime = createCodexAppServer(() => executable)
  runtime.actor.start()
  try {
    const info = await runtime.readHarnessInfo()
    assert.equal(info.availability, 'available')
    assert.equal(info.harness, 'codex')
    runtime.close()
    await waitFor(runtime.actor, (snapshot) => snapshot.matches('Closed'))
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(await readFile(closed, 'utf8'), 'closed')
  } finally {
    runtime.actor.stop()
    await rm(directory, { recursive: true, force: true })
  }
})
