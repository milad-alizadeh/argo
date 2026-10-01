import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import type {
  PermissionDeniedHookInput,
  PostToolUseFailureHookInput,
  PostToolUseHookInput,
  StopFailureHookInput,
} from '@anthropic-ai/claude-agent-sdk'
import { installStatusHooks, removeStatusHooks } from '@/harnesses/host/status-hooks'
import { testStatusHookInstall } from '@/mocks/cli/status-hook-install-suite'
import { type HOOK_FIXTURES, hookReadings } from '@/mocks/cli/status-hooks'
import { claudeSettingsFile, createClaudeStatusHooks } from './claude-status-hooks'

// Each docs fixture payload of `Shape` carries what the Agent SDK says Claude sends with `Input`.
type Payload = (typeof HOOK_FIXTURES.claude)['bashTurn' | 'failureTurn'][number]['payload']
type Carries<Shape, Input> = [Extract<Payload, Shape>] extends [never]
  ? false
  : Extract<Payload, Shape> extends Omit<Input, 'hook_event_name'>
    ? true
    : false
true satisfies Carries<{ tool_response: unknown }, PostToolUseHookInput>
true satisfies Carries<{ is_interrupt: unknown }, PostToolUseFailureHookInput>
true satisfies Carries<{ reason: unknown; tool_use_id: unknown }, PermissionDeniedHookInput>
// JSON types the error code as a string.
true satisfies Carries<
  { error: unknown; last_assistant_message: unknown },
  Omit<StopFailureHookInput, 'error'> & { error: string }
>

const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-settings-'))
after(() => rm(folder, { recursive: true, force: true }))
const settings = path.join(folder, 'settings.json')
const SOCKET = '/tmp/argo/hooks.sock'
const claudeHooks = () => createClaudeStatusHooks(settings)
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
    hooks: claudeHooks(),
    read: async () => (await readJson(settings)).hooks ?? {},
  }
})

test('a Claude install keeps every other setting and hook, and its removal leaves them as they were', async () => {
  await seed(JSON.stringify(USER_SETTINGS))
  await installStatusHooks('claude', claudeHooks(), SOCKET)
  const written = await readJson(settings)
  assert.deepEqual(Object.keys(written), ['model', 'hooks', 'permissions'])
  assert.deepEqual(written.hooks.Notification, USER_SETTINGS.hooks.Notification)
  await removeStatusHooks('claude', claudeHooks(), SOCKET)
  assert.deepEqual(await readJson(settings), USER_SETTINGS)
})

test('a Claude removal after an install into settings with no hooks leaves no hooks table', async () => {
  await seed(JSON.stringify({ model: 'opus' }))
  await installStatusHooks('claude', claudeHooks(), SOCKET)
  await removeStatusHooks('claude', claudeHooks(), SOCKET)
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
    await assert.rejects(installStatusHooks('claude', claudeHooks(), SOCKET))
    await assert.rejects(removeStatusHooks('claude', claudeHooks(), SOCKET))
    assert.equal(await readFile(settings, 'utf8'), text)
  })

test('a Claude settings link to a file is written through, keeping the link', async () => {
  const target = path.join(path.dirname(settings), 'dotfiles-settings.json')
  await seed(null)
  await writeFile(target, JSON.stringify({ model: 'opus' }))
  await symlink(target, settings)
  await installStatusHooks('claude', claudeHooks(), SOCKET)
  assert.ok((await lstat(settings)).isSymbolicLink())
  assert.equal((await readJson(target)).model, 'opus')
  assert.ok((await readJson(target)).hooks.Stop)
})

test('the Claude settings file is in CLAUDE_CONFIG_DIR, else in the home Claude folder', () => {
  assert.equal(claudeSettingsFile({}, '/home/me'), '/home/me/.claude/settings.json')
  assert.equal(
    claudeSettingsFile({ CLAUDE_CONFIG_DIR: '/config' }, '/home/me'),
    '/config/settings.json',
  )
})

test('each Claude event of a Bash Turn sets its status, and PreToolUse its activity line', () => {
  assert.deepEqual(hookReadings('claude', claudeHooks(), 'bashTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'running', 'Run test suite'],
    ['PermissionRequest', 'permission', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})

test('a failed or denied Claude tool ends its permission prompt, and a failed Turn shows idle', () => {
  assert.deepEqual(hookReadings('claude', claudeHooks(), 'failureTurn'), [
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'running', 'Run test suite'],
    ['PermissionRequest', 'permission', null],
    ['PostToolUseFailure', 'running', null],
    ['PreToolUse', 'running', 'Remove the build folder'],
    ['PermissionDenied', 'running', null],
    ['StopFailure', 'idle', null],
  ])
})

test('a Claude AskUserQuestion shows asking until it is answered', () => {
  assert.deepEqual(hookReadings('claude', claudeHooks(), 'questionTurn'), [
    ['SessionStart', null, null],
    ['UserPromptSubmit', 'running', null],
    ['PreToolUse', 'asking', null],
    ['PermissionRequest', 'asking', null],
    ['PostToolUse', 'running', null],
    ['Stop', 'idle', null],
    ['SessionEnd', 'idle', null],
  ])
})
