import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerProject } from '@/domains/projects/main/register-project'
import { selectProject } from '@/domains/projects/main/select-project'
import { fixture, register, repository } from '../../../../mocks/projects/mock-registration'

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
  assert.equal(setup.store.projects.read().selectedId, beta.selectedId)
})

test('selecting an unregistered identity refuses without writing', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const alpha = await registerProject(register('r1'), setup.store)
  const before = setup.store.projects.read()
  const reply = await selectProject(select('s1', 'project-unknown'), setup.store)
  assert.equal(reply.code, 'missing-project')
  assert.deepEqual(setup.store.projects.read(), before)
  assert.equal(alpha.selectedId, alpha.selectedId)
})
