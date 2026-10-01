import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, type TestContext, test } from 'node:test'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import { MOCK_CODEX_USER_CONFIG_FILE } from '@/mocks/cli/codex/fixtures/mock-codex-user-config'
import { clientBackedByMock, writeMockCodex } from '@/mocks/cli/codex/mock-codex-driver'
import { guardRealUserConfig } from '@/mocks/cli/real-user-config'
import { EXPECTED_HOOK_EVENTS, expectedHookGroup } from '@/mocks/cli/status-hooks'
import { createCodexExternalSessions } from './codex-external-sessions'

const realConfigUnchanged = guardRealUserConfig()
after(realConfigUnchanged)

const EVENTS = EXPECTED_HOOK_EVENTS
const argoGroup = (port: number, event: string) => expectedHookGroup('codex', port, event)
const USER_STOP = { hooks: [{ type: 'command', command: 'say done' }] }
const USER_BASH = { matcher: '^Bash$', hooks: [{ type: 'command', command: './check.sh' }] }
// The trust Codex records for a reviewed hook sits in the same table.
const TRUST = { 'config.toml:stop:0:0': { trusted_hash: 'sha256:1' } }
const USER_CONFIG = {
  model: 'gpt-5.5',
  hooks: { Stop: [USER_STOP], PreToolUse: [USER_BASH], state: TRUST },
}

// A mock app-server with its own throwaway CODEX_HOME, where it keeps the user config layer.
async function codex(context: TestContext, config?: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-hooks-'))
  const codexHome = path.join(root, 'codex-home')
  await mkdir(codexHome)
  const file = path.join(codexHome, MOCK_CODEX_USER_CONFIG_FILE)
  if (config !== undefined) await writeFile(file, config)
  const client = clientBackedByMock(await writeMockCodex(root, { CODEX_HOME: codexHome }))
  context.after(async () => {
    client.shutdown()
    await rm(root, { recursive: true, force: true })
  })
  const hooks = createCodexExternalSessions(client.request, codexHome).hooks
  assert.ok(hooks)
  return { hooks: hooks as ExternalSessionHooks, file }
}

const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))

test('an install into an empty Codex config adds one entry per event, naming the port', async (context) => {
  const { hooks, file } = await codex(context)
  await hooks.install(4321)
  const written = await readJson(file)
  assert.deepEqual(Object.keys(written.hooks), EVENTS)
  for (const event of EVENTS) assert.deepEqual(written.hooks[event], [argoGroup(4321, event)])
  assert.equal(await hooks.installedPort(), 4321)
})

test('an install keeps every other key, hook and trust record in place, and a second install writes nothing', async (context) => {
  const { hooks, file } = await codex(context, JSON.stringify(USER_CONFIG))
  await hooks.install(4321)
  const written = await readJson(file)
  assert.equal(written.model, 'gpt-5.5')
  assert.deepEqual(written.hooks.state, TRUST)
  assert.deepEqual(written.hooks.Stop, [USER_STOP, argoGroup(4321, 'Stop')])
  assert.deepEqual(written.hooks.PreToolUse, [USER_BASH, argoGroup(4321, 'PreToolUse')])

  // The mock writes indented JSON, so any write would change this compact text.
  const before = JSON.stringify(written)
  await writeFile(file, before)
  await hooks.install(4321)
  assert.equal(await readFile(file, 'utf8'), before)
})

test('a new port rewrites only Argo entries, where they stand', async (context) => {
  const { hooks, file } = await codex(context, JSON.stringify(USER_CONFIG))
  await hooks.install(4321)
  const installed = await readJson(file)
  installed.hooks.Stop.push(USER_BASH)
  await writeFile(file, JSON.stringify(installed))
  await hooks.install(5555)
  assert.deepEqual((await readJson(file)).hooks.Stop, [
    USER_STOP,
    argoGroup(5555, 'Stop'),
    USER_BASH,
  ])
  assert.equal(await hooks.installedPort(), 5555)
})

test('the removal deletes exactly the entries Argo wrote', async (context) => {
  const { hooks, file } = await codex(context, JSON.stringify(USER_CONFIG))
  await hooks.install(4321)
  await hooks.remove()
  assert.deepEqual(await readJson(file), USER_CONFIG)
  assert.equal(await hooks.installedPort(), null)
})

for (const [label, text] of [
  ['Codex cannot read', '{ "hooks": '],
  ['has an event value that is not a list', '{ "hooks": { "Stop": {} } }'],
] as const)
  test(`a config that ${label} is not written`, async (context) => {
    const { hooks, file } = await codex(context, text)
    await assert.rejects(hooks.install(4321))
    await assert.rejects(hooks.remove())
    assert.equal(await readFile(file, 'utf8'), text)
  })
