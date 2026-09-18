import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readProjectConfiguration, saveProjectConfiguration } from './project-configuration'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-project-configuration-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  await mkdir(path.join(project, '.argo'))
  return project
}

test('reads one default target with its setup, run, build and test commands', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    [
      'version = 1',
      '',
      '[targets.app]',
      'default = true',
      'path = "."',
      'setup = "bun install"',
      'run = "bun run dev"',
      'build = "bun run build"',
      'test = "bun test"',
      '',
    ].join('\n'),
  )

  assert.deepEqual(await readProjectConfiguration(project), {
    targets: [
      {
        name: 'app',
        path: '.',
        default: true,
        setup: 'bun install',
        run: 'bun run dev',
        build: 'bun run build',
        test: 'bun test',
      },
    ],
  })
})

test('keeps a hash inside a quoted command', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    [
      'version = 1',
      '',
      '[targets.app]',
      'default = true',
      'path = "."',
      'setup = "true"',
      'run = "echo #ready"',
      'build = "true"',
      'test = "true"',
      '',
    ].join('\n'),
  )

  assert.equal((await readProjectConfiguration(project))?.targets[0]?.run, 'echo #ready')
})

test('does not make commands locally overridable', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    [
      'version = 1',
      '',
      '[targets.app]',
      'default = true',
      'path = "."',
      'test = "bun test"',
      '',
    ].join('\n'),
  )
  await writeFile(
    path.join(project, '.argo', 'settings.local.toml'),
    ['[targets.app]', 'path = "packages/app"', 'test = "rm -rf ."', ''].join('\n'),
  )

  assert.equal(await readProjectConfiguration(project), null)
})

test('does not treat an incomplete shared configuration as ready', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    ['version = 1', '', '[targets.app]', 'default = false', 'path = "."', ''].join('\n'),
  )

  assert.equal(await readProjectConfiguration(project), null)
})

test('saves a manual shared configuration without writing local overrides', async (context) => {
  const project = await fixture(context)
  const source = [
    '# A reviewed Project configuration.',
    'version = 1',
    '',
    '[targets.app]',
    'default = true',
    'path = "."',
    'setup = "bun install"',
    'run = "bun run dev"',
    'build = "bun run build"',
    'test = "bun test"',
    '',
  ].join('\n')

  assert.equal(await saveProjectConfiguration(project, source), true)
  assert.equal(await readFile(path.join(project, '.argo', 'settings.toml'), 'utf8'), source)
  assert.equal((await readProjectConfiguration(project)) === null, false)
})
