import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import {
  compactionHookCommand,
  installCompactionHook,
} from '@/harnesses/claude/compaction/compaction-hook'
import { readCompactionStarts } from '@/harnesses/claude/compaction/compaction-starts'

async function claudeHome(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo compaction '))
  context.after(() => rm(root, { recursive: true, force: true }))
  return {
    root,
    settings: path.join(root, '.claude', 'settings.json'),
    starts: path.join(root, 'compaction starts'),
  }
}

async function readSettings(settings: string) {
  return JSON.parse(await readFile(settings, 'utf8')) as {
    hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]>
  } & Record<string, unknown>
}

function argoHooks(document: Awaited<ReturnType<typeof readSettings>>, starts: string) {
  return (document.hooks.PreCompact ?? []).filter((entry) =>
    entry.hooks.some((hook) => hook.command === compactionHookCommand(starts)),
  )
}

function runHook(command: string, input: string) {
  return spawnSync('/bin/sh', ['-c', command], { input, encoding: 'utf8' })
}

test('installs the compaction hook into a settings file that does not exist yet', async (context) => {
  const home = await claudeHome(context)
  assert.equal(await installCompactionHook(home.settings, home.starts), 'installed')
  assert.equal(argoHooks(await readSettings(home.settings), home.starts).length, 1)
})

test('keeps every other setting and hook when it installs', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.starts)
  const theirs = {
    model: 'opus',
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'their-backup.sh' }] }],
    },
  }
  await writeFile(home.settings, JSON.stringify(theirs))
  await installCompactionHook(home.settings, home.starts)
  const written = await readSettings(home.settings)
  assert.equal(written.model, 'opus')
  assert.deepEqual(written.hooks.PreToolUse, theirs.hooks.PreToolUse)
  assert.equal(written.hooks.PreCompact?.[0]?.hooks[0]?.command, 'their-backup.sh')
  assert.equal(argoHooks(written, home.starts).length, 1)
})

test('leaves a settings file that already carries the hook untouched', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.starts)
  const before = await readFile(home.settings, 'utf8')
  assert.equal(await installCompactionHook(home.settings, home.starts), 'present')
  assert.equal(await readFile(home.settings, 'utf8'), before)
})

test('replaces an older Argo compaction hook rather than adding a second', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, path.join(home.root, 'old starts'))
  await installCompactionHook(home.settings, home.starts)
  const entries = (await readSettings(home.settings)).hooks.PreCompact ?? []
  assert.deepEqual(
    entries.flatMap((entry) => entry.hooks.map((hook) => hook.command)),
    [compactionHookCommand(home.starts)],
  )
})

test('refuses a settings file it cannot read as JSON and leaves it as it was', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.starts)
  await writeFile(home.settings, '{ "model": "opus", // hand-edited\n}')
  assert.equal(await installCompactionHook(home.settings, home.starts), 'refused')
  assert.equal(await readFile(home.settings, 'utf8'), '{ "model": "opus", // hand-edited\n}')
})

test('writes through a symlinked settings file and keeps its permissions', async (context) => {
  const home = await claudeHome(context)
  const real = path.join(home.root, 'dotfiles-settings.json')
  await writeFile(real, '{"model":"opus"}', { mode: 0o600 })
  await installCompactionHook(home.settings, home.starts)
  await rm(home.settings)
  await symlink(real, home.settings)
  await installCompactionHook(home.settings, home.starts)
  assert.equal((await lstat(home.settings)).isSymbolicLink(), true)
  assert.equal(argoHooks(await readSettings(real), home.starts).length, 1)
  assert.equal((await stat(real)).mode & 0o777, 0o600)
})

test('refuses a settings link whose target is gone and keeps the link', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.starts)
  await rm(home.settings)
  await symlink(path.join(home.root, 'moved-dotfiles.json'), home.settings)
  assert.equal(await installCompactionHook(home.settings, home.starts), 'refused')
  assert.equal((await lstat(home.settings)).isSymbolicLink(), true)
})

test('leaves the file untouched when the person added their own hook after Argo', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.starts)
  const document = await readSettings(home.settings)
  document.hooks.PreCompact?.push({ hooks: [{ command: 'their-backup.sh' }] })
  await writeFile(home.settings, JSON.stringify(document))
  assert.equal(await installCompactionHook(home.settings, home.starts), 'present')
})

test('the hook leaves a start file naming the Session it ran for', async (context) => {
  const home = await claudeHome(context)
  const input = JSON.stringify({ session_id: 'session-a', hook_event_name: 'PreCompact' })
  assert.equal(runHook(compactionHookCommand(home.starts), input).status, 0)
  const starts = await readCompactionStarts(home.starts)
  assert.deepEqual(
    starts.map((start) => start.sessionId),
    ['session-a'],
  )
})

test('the hook never fails a compaction when it cannot write its start file', async (context) => {
  const home = await claudeHome(context)
  await writeFile(home.starts, 'a file where the folder should be')
  const result = runHook(compactionHookCommand(home.starts), '{"session_id":"session-a"}')
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
})
