import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { validateProjectConfiguration } from './setup-validation'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-setup-validation-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  await mkdir(path.join(project, '.argo'))
  return project
}

function source(commands: { setup: string; run: string; build: string; test: string }) {
  return [
    'version = 1',
    '',
    '[targets.app]',
    'default = true',
    'path = "."',
    `setup = "${commands.setup}"`,
    `run = "${commands.run}"`,
    `build = "${commands.build}"`,
    `test = "${commands.test}"`,
    '',
  ].join('\n')
}

test('validates setup, run, build, and test commands in the target path', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    source({
      setup: 'touch setup-ran',
      run: 'touch run-ran',
      build: 'touch build-ran',
      test: 'touch test-ran',
    }),
  )

  assert.equal(await validateProjectConfiguration(project), true)
  for (const file of ['setup-ran', 'run-ran', 'build-ran', 'test-ran']) {
    await access(path.join(project, file))
  }
})

test('stops validation when a command fails', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.toml'),
    source({
      setup: 'false',
      run: 'touch run-ran',
      build: 'touch build-ran',
      test: 'touch test-ran',
    }),
  )

  assert.equal(await validateProjectConfiguration(project), false)
  await assert.rejects(access(path.join(project, 'run-ran')))
})
