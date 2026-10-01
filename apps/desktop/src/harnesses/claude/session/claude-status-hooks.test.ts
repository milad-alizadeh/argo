import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, type TestContext, test } from 'node:test'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import { guardRealUserConfig, isolateHarnessFolders } from '@/mocks/cli/real-user-config'
import { EXPECTED_HOOK_EVENTS, expectedHookGroup } from '@/mocks/cli/status-hooks'
import { createClaudeExternalSessions } from './claude-external-sessions'

const realConfigUnchanged = guardRealUserConfig()
after(realConfigUnchanged)

const EVENTS = EXPECTED_HOOK_EVENTS
const argoGroup = (port: number, event: string) => expectedHookGroup('claude', port, event)
const USER_STOP = { hooks: [{ type: 'command', command: 'say done' }] }
const USER_BASH = { matcher: 'Bash', hooks: [{ type: 'command', command: './check.sh' }] }
const USER_SETTINGS = {
  model: 'opus',
  hooks: { Stop: [USER_STOP], PreToolUse: [USER_BASH], Notification: [USER_STOP] },
  permissions: { allow: ['Bash(ls)'] },
}

async function claudeFolder(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-hooks-'))
  const restore = isolateHarnessFolders(root)
  context.after(async () => {
    restore()
    await rm(root, { recursive: true, force: true })
  })
  const folder = process.env.CLAUDE_CONFIG_DIR as string
  await mkdir(folder, { recursive: true })
  return { root, settings: path.join(folder, 'settings.json') }
}

function hooksOf(): ExternalSessionHooks {
  const hooks = createClaudeExternalSessions(null).hooks
  assert.ok(hooks)
  return hooks
}

const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))

test('an install into an empty Claude folder adds one entry per event, naming the port', async (context) => {
  const { settings } = await claudeFolder(context)
  await hooksOf().install(4321)
  const written = await readJson(settings)
  assert.deepEqual(Object.keys(written.hooks), EVENTS)
  for (const event of EVENTS) assert.deepEqual(written.hooks[event], [argoGroup(4321, event)])
  assert.equal(await hooksOf().installedPort(), 4321)
})

test('an install keeps every other setting and hook in place, and a second install writes nothing', async (context) => {
  const { settings } = await claudeFolder(context)
  await writeFile(settings, JSON.stringify(USER_SETTINGS, null, 2))
  await hooksOf().install(4321)
  const written = await readJson(settings)
  assert.deepEqual(Object.keys(written), ['model', 'hooks', 'permissions'])
  assert.equal(written.model, 'opus')
  assert.deepEqual(written.permissions, USER_SETTINGS.permissions)
  assert.deepEqual(written.hooks.Stop, [USER_STOP, argoGroup(4321, 'Stop')])
  assert.deepEqual(written.hooks.PreToolUse, [USER_BASH, argoGroup(4321, 'PreToolUse')])
  assert.deepEqual(written.hooks.Notification, [USER_STOP])
  assert.deepEqual(Object.keys(written.hooks).slice(0, 3), ['Stop', 'PreToolUse', 'Notification'])

  const before = {
    text: await readFile(settings, 'utf8'),
    modified: (await stat(settings)).mtimeMs,
  }
  await new Promise((resolve) => setTimeout(resolve, 20))
  await hooksOf().install(4321)
  assert.equal(await readFile(settings, 'utf8'), before.text)
  assert.equal((await stat(settings)).mtimeMs, before.modified)
})

test('a new port rewrites only Argo entries, where they stand', async (context) => {
  const { settings } = await claudeFolder(context)
  await writeFile(settings, JSON.stringify(USER_SETTINGS))
  await hooksOf().install(4321)
  const installed = await readJson(settings)
  installed.hooks.Stop.push(USER_BASH)
  await writeFile(settings, JSON.stringify(installed))
  await hooksOf().install(5555)
  const written = await readJson(settings)
  assert.deepEqual(written.hooks.Stop, [USER_STOP, argoGroup(5555, 'Stop'), USER_BASH])
  assert.equal(await hooksOf().installedPort(), 5555)
})

test('the removal deletes exactly the entries Argo wrote', async (context) => {
  const { settings } = await claudeFolder(context)
  await writeFile(settings, JSON.stringify(USER_SETTINGS))
  await hooksOf().install(4321)
  await hooksOf().remove()
  assert.deepEqual(await readJson(settings), USER_SETTINGS)
  assert.equal(await hooksOf().installedPort(), null)
})

test('a removal after an install into no settings leaves no hooks table', async (context) => {
  const { settings } = await claudeFolder(context)
  await writeFile(settings, JSON.stringify({ model: 'opus' }))
  await hooksOf().install(4321)
  await hooksOf().remove()
  assert.deepEqual(await readJson(settings), { model: 'opus' })
})

for (const [label, text] of [
  ['is not JSON', '{ "hooks": '],
  ['is not an object', '[]'],
  ['has a hooks value that is not an object', '{ "hooks": [] }'],
  ['has an event value that is not a list', '{ "hooks": { "Stop": {} } }'],
] as const)
  test(`a settings file that ${label} is not written`, async (context) => {
    const { settings } = await claudeFolder(context)
    await writeFile(settings, text)
    await assert.rejects(hooksOf().install(4321))
    await assert.rejects(hooksOf().remove())
    assert.equal(await readFile(settings, 'utf8'), text)
  })

// A child process, because Bun reads HOME once at start and a change to it here moves nothing.
test('without CLAUDE_CONFIG_DIR the install writes the settings in the home Claude folder', async (context) => {
  const { root } = await claudeFolder(context)
  const home = path.join(root, 'home')
  const { CLAUDE_CONFIG_DIR: _unset, ...environment } = process.env
  const install = `
    const { createClaudeExternalSessions } = await import(${JSON.stringify(import.meta.resolve('./claude-external-sessions'))})
    if ((await import('node:os')).homedir() !== ${JSON.stringify(home)}) process.exit(3)
    await createClaudeExternalSessions(null).hooks.install(4321)`
  const result = spawnSync(process.execPath, ['-e', install], {
    env: { ...environment, HOME: home },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const written = await readJson(path.join(home, '.claude', 'settings.json'))
  assert.deepEqual(written.hooks.Stop, [argoGroup(4321, 'Stop')])
  await assert.rejects(stat(path.join(root, 'claude-config', 'settings.json')))
})
