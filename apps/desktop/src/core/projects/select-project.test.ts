import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { registerProject } from './register-project'
import { fixture, register, repository } from '../../../mocks/projects/mock-registration'
import { selectProject } from './select-project'

const select = (id, projectId) => ({
  version: 1,
  type: 'project.select',
  requestId: id,
  projectId,
})

test('selecting a registered Project writes selectedId to the registry', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  await registerProject(register('r1'), setup.store)
  setup.choose(await repository(setup.root, 'beta'))
  const beta = await registerProject(register('r2'), setup.store)
  const reply = await selectProject(select('s1', beta.selectedId), setup.store)
  assert.equal(reply.selectedId, beta.selectedId)
  assert.equal(
    JSON.parse(await readFile(setup.store.registryPath, 'utf8')).selectedId,
    beta.selectedId,
  )
})

test('selecting an unregistered identity refuses without writing', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const alpha = await registerProject(register('r1'), setup.store)
  const before = await readFile(setup.store.registryPath, 'utf8')
  const reply = await selectProject(select('s1', 'project-unknown'), setup.store)
  assert.equal(reply.code, 'missing-project')
  assert.equal(await readFile(setup.store.registryPath, 'utf8'), before)
  assert.equal(alpha.selectedId, alpha.selectedId)
})
