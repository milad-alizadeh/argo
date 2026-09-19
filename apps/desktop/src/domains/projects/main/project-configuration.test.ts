import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  readProjectConfiguration,
  saveProjectConfiguration,
} from '@/domains/projects/main/project-configuration'
import { projectConfigurationSource } from '../../../../test-fixtures/projects/project-configuration.fixture'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-project-configuration-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  await mkdir(path.join(project, '.argo'))
  return project
}

test('reads one default target from JSON with its setup, run, build and test commands', async (context) => {
  const project = await fixture(context)
  await writeFile(path.join(project, '.argo', 'settings.json'), projectConfigurationSource())

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
    path.join(project, '.argo', 'settings.json'),
    projectConfigurationSource({ setup: 'true', run: 'echo #ready', build: 'true', test: 'true' }),
  )

  assert.equal((await readProjectConfiguration(project))?.targets[0]?.run, 'echo #ready')
})

test('does not make commands locally overridable', async (context) => {
  const project = await fixture(context)
  await writeFile(path.join(project, '.argo', 'settings.json'), projectConfigurationSource())
  await writeFile(
    path.join(project, '.argo', 'settings.local.json'),
    JSON.stringify({ targets: { app: { path: 'packages/app', test: 'rm -rf .' } } }),
  )

  assert.equal(await readProjectConfiguration(project), null)
})

test('does not treat an incomplete shared configuration as ready', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.json'),
    JSON.stringify({ version: 1, targets: { app: { default: false, path: '.' } } }),
  )

  assert.equal(await readProjectConfiguration(project), null)
})

test('saves a manual shared configuration without writing local overrides', async (context) => {
  const project = await fixture(context)
  const source = projectConfigurationSource()

  assert.equal(await saveProjectConfiguration(project, source), true)
  assert.equal(await readFile(path.join(project, '.argo', 'settings.json'), 'utf8'), source)
  assert.equal((await readProjectConfiguration(project)) === null, false)
})
