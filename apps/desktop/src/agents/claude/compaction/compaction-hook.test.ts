import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { compactionHookCommand, installCompactionHook } from './compaction-hook'
import { readCompactionMarkers } from './compaction-markers'

async function claudeHome(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo compaction '))
  context.after(() => rm(root, { recursive: true, force: true }))
  return {
    root,
    settings: path.join(root, '.claude', 'settings.json'),
    markers: path.join(root, 'compaction markers'),
  }
}

async function readSettings(settings: string) {
  return JSON.parse(await readFile(settings, 'utf8')) as {
    hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]>
  } & Record<string, unknown>
}

function argoHooks(document: Awaited<ReturnType<typeof readSettings>>, markers: string) {
  return (document.hooks.PreCompact ?? []).filter((entry) =>
    entry.hooks.some((hook) => hook.command === compactionHookCommand(markers)),
  )
}

function runHook(command: string, input: string) {
  return spawnSync('/bin/sh', ['-c', command], { input, encoding: 'utf8' })
}

test('installs the compaction hook into a settings file that does not exist yet', async (context) => {
  const home = await claudeHome(context)
  assert.equal(await installCompactionHook(home.settings, home.markers), 'installed')
  assert.equal(argoHooks(await readSettings(home.settings), home.markers).length, 1)
})

test('keeps every other setting and hook when it installs', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.markers)
  const theirs = {
    model: 'opus',
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'their-backup.sh' }] }],
    },
  }
  await writeFile(home.settings, JSON.stringify(theirs))
  await installCompactionHook(home.settings, home.markers)
  const written = await readSettings(home.settings)
  assert.equal(written.model, 'opus')
  assert.deepEqual(written.hooks.PreToolUse, theirs.hooks.PreToolUse)
  assert.equal(written.hooks.PreCompact?.[0]?.hooks[0]?.command, 'their-backup.sh')
  assert.equal(argoHooks(written, home.markers).length, 1)
})

test('leaves a settings file that already carries the hook untouched', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.markers)
  const before = await readFile(home.settings, 'utf8')
  assert.equal(await installCompactionHook(home.settings, home.markers), 'present')
  assert.equal(await readFile(home.settings, 'utf8'), before)
})

test('replaces an older Argo compaction hook rather than adding a second', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, path.join(home.root, 'old markers'))
  await installCompactionHook(home.settings, home.markers)
  const entries = (await readSettings(home.settings)).hooks.PreCompact ?? []
  assert.deepEqual(
    entries.flatMap((entry) => entry.hooks.map((hook) => hook.command)),
    [compactionHookCommand(home.markers)],
  )
})

test('refuses a settings file it cannot read as JSON and leaves it as it was', async (context) => {
  const home = await claudeHome(context)
  await installCompactionHook(home.settings, home.markers)
  await writeFile(home.settings, '{ "model": "opus", // hand-edited\n}')
  assert.equal(await installCompactionHook(home.settings, home.markers), 'refused')
  assert.equal(await readFile(home.settings, 'utf8'), '{ "model": "opus", // hand-edited\n}')
})

test('writes through a symlinked settings file and keeps its permissions', async (context) => {
  const home = await claudeHome(context)
  const real = path.join(home.root, 'dotfiles-settings.json')
  await writeFile(real, '{"model":"opus"}', { mode: 0o600 })
  await installCompactionHook(home.settings, home.markers)
  await rm(home.settings)
  await symlink(real, home.settings)
  await installCompactionHook(home.settings, home.markers)
  assert.equal((await lstat(home.settings)).isSymbolicLink(), true)
  assert.equal(argoHooks(await readSettings(real), home.markers).length, 1)
  assert.equal((await stat(real)).mode & 0o777, 0o600)
})

test('the hook leaves a marker naming the Session it ran for', async (context) => {
  const home = await claudeHome(context)
  const input = JSON.stringify({ session_id: 'session-a', hook_event_name: 'PreCompact' })
  assert.equal(runHook(compactionHookCommand(home.markers), input).status, 0)
  const markers = await readCompactionMarkers(home.markers)
  assert.deepEqual(
    markers.map((marker) => marker.sessionId),
    ['session-a'],
  )
})

test('the hook never fails a compaction when it cannot write its marker', async (context) => {
  const home = await claudeHome(context)
  await writeFile(home.markers, 'a file where the folder should be')
  const result = runHook(compactionHookCommand(home.markers), '{"session_id":"session-a"}')
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
})
