import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import type { PostToolUseHookInput } from '@anthropic-ai/claude-agent-sdk'
import { installStatusHooks, removeStatusHooks } from '@/harnesses/host/status-hooks'
import { testStatusHookInstall } from '@/mocks/cli/status-hook-install-suite'
import { type HOOK_FIXTURES, hookReadings } from '@/mocks/cli/status-hooks'
import { createClaudeStatusHooks } from './claude-status-hooks'

// The docs fixture's PostToolUse carries what the Agent SDK says Claude sends with one.
type FixturePostToolUse = Extract<
  (typeof HOOK_FIXTURES.claude.bashTurn)[number]['payload'],
  { tool_response: unknown }
>
true satisfies [FixturePostToolUse] extends [never]
  ? false
  : FixturePostToolUse extends Omit<PostToolUseHookInput, 'hook_event_name'>
    ? true
    : false

const settings = path.join(process.env.CLAUDE_CONFIG_DIR as string, 'settings.json')
const USER_SETTINGS = {
  model: 'opus',
  hooks: {
    Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './check.sh' }] }],
    Notification: [{ hooks: [{ type: 'command', command: 'say hi' }] }],
  },
  permissions: { allow: ['Bash(ls)'] },
}

const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'))

async function seed(text: string | null) {
  await mkdir(path.dirname(settings), { recursive: true })
  await rm(settings, { force: true })
  if (text !== null) await writeFile(settings, text)
}

testStatusHookInstall('claude', async (_context, userHooks) => {
  const { Notification: _other, ...hooks } = USER_SETTINGS.hooks
  await seed(userHooks ? JSON.stringify({ hooks }) : null)
  return {
    hooks: createClaudeStatusHooks(),
    read: async () => (await readJson(settings)).hooks ?? {},
  }
})

test('a Claude install keeps every other setting and hook, and its removal leaves them as they were', async () => {
  await seed(JSON.stringify(USER_SETTINGS))
  await installStatusHooks('claude', createClaudeStatusHooks(), 4321)
  const written = await readJson(settings)
  assert.deepEqual(Object.keys(written), ['model', 'hooks', 'permissions'])
  assert.deepEqual(written.hooks.Notification, USER_SETTINGS.hooks.Notification)
  await removeStatusHooks('claude', createClaudeStatusHooks())
  assert.deepEqual(await readJson(settings), USER_SETTINGS)
})

test('a Claude removal after an install into settings with no hooks leaves no hooks table', async () => {
  await seed(JSON.stringify({ model: 'opus' }))
  await installStatusHooks('claude', createClaudeStatusHooks(), 4321)
  await removeStatusHooks('claude', createClaudeStatusHooks())
  assert.deepEqual(await readJson(settings), { model: 'opus' })
})

for (const [label, text] of [
  ['is not JSON', '{ "hooks": '],
  ['is not an object', '[]'],
  ['has a hooks value that is not an object', '{ "hooks": [] }'],
  ['has an event value that is not a list', '{ "hooks": { "Stop": {} } }'],
] as const)
  test(`Claude settings that ${label} are not written`, async () => {
    await seed(text)
    await assert.rejects(installStatusHooks('claude', createClaudeStatusHooks(), 4321))
    await assert.rejects(removeStatusHooks('claude', createClaudeStatusHooks()))
    assert.equal(await readFile(settings, 'utf8'), text)
  })

test('a Claude settings link to a file is written through, keeping the link', async () => {
  const target = path.join(path.dirname(settings), 'dotfiles-settings.json')
  await seed(null)
  await writeFile(target, JSON.stringify({ model: 'opus' }))
  await symlink(target, settings)
  await installStatusHooks('claude', createClaudeStatusHooks(), 4321)
  assert.ok((await lstat(settings)).isSymbolicLink())
  assert.equal((await readJson(target)).model, 'opus')
  assert.ok((await readJson(target)).hooks.Stop)
})

// A child process, because Bun reads HOME once at start and a change to it here moves nothing.
test('without CLAUDE_CONFIG_DIR the install writes the settings in the home Claude folder', async (context) => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-home-'))
  context.after(() => rm(home, { recursive: true, force: true }))
  const { CLAUDE_CONFIG_DIR: _unset, ...environment } = process.env
  const install = `
    const { createClaudeStatusHooks } = await import(${JSON.stringify(import.meta.resolve('./claude-status-hooks'))})
    const { installStatusHooks } = await import(${JSON.stringify(import.meta.resolve('@/harnesses/host/status-hooks'))})
    if ((await import('node:os')).homedir() !== ${JSON.stringify(home)}) process.exit(3)
    await installStatusHooks('claude', createClaudeStatusHooks(), 4321)`
  const result = spawnSync(process.execPath, ['-e', install], {
    env: { ...environment, HOME: home },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.ok((await readJson(path.join(home, '.claude', 'settings.json'))).hooks.Stop)
})

test('each Claude event of a Bash Turn sets its status, and PreToolUse its activity line', () => {
  assert.deepEqual(hookReadings('claude', createClaudeStatusHooks(), 'bashTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'running', 'Run test suite'],
    ['PermissionRequest', 'permission', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})

test('a Claude AskUserQuestion shows asking until it is answered', () => {
  assert.deepEqual(hookReadings('claude', createClaudeStatusHooks(), 'questionTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'asking', null],
    ['PermissionRequest', 'asking', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})
