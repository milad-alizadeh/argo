import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { validateProjectConfiguration } from '@/domains/projects/main/setup/preparation/setup-validation'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-setup-validation-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  await mkdir(path.join(project, '.argo'))
  return project
}

function source(commands: { setup: string; run: string; build: string; test: string }) {
  return JSON.stringify({
    version: 1,
    targets: { app: { default: true, path: '.', ...commands } },
  })
}

test('validates setup, run, build, and test commands in the target path', async (context) => {
  const project = await fixture(context)
  await writeFile(
    path.join(project, '.argo', 'settings.json'),
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
    path.join(project, '.argo', 'settings.json'),
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

test('validates an unsaved configuration without replacing the configuration file', async (context) => {
  const project = await fixture(context)
  const savedSource = source({ setup: 'false', run: 'false', build: 'false', test: 'false' })
  await writeFile(path.join(project, '.argo', 'settings.json'), savedSource)

  const draftSource = source({
    setup: 'touch setup-ran',
    run: 'touch run-ran',
    build: 'touch build-ran',
    test: 'touch test-ran',
  })

  assert.equal(await validateProjectConfiguration(project, draftSource), true)
  assert.equal(await readFile(path.join(project, '.argo', 'settings.json'), 'utf8'), savedSource)
  await access(path.join(project, 'test-ran'))
})

test('passes a run command that is still running after the grace period', async (context) => {
  const project = await fixture(context)
  const draftSource = source({ setup: 'true', run: 'sleep 60', build: 'true', test: 'true' })

  assert.equal(await validateProjectConfiguration(project, draftSource), true)
})
