import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  fixture,
  register,
  registerElsewhere,
  relocate,
  repository,
} from '../../../../mocks/projects/mock-registration'
import { registerProject, relocateProject } from './register-project'

test('relocating moves the path and keeps the identity', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const registered = await registerProject(register('r1'), setup.store)
  const moved = await repository(setup.root, 'moved')
  setup.choose(moved)
  const projectId = registered.projects[0]?.id
  const reply = await relocateProject(relocate('m1', projectId ?? ''), setup.store)
  assert.deepEqual(reply.projects, [{ id: projectId, name: 'moved', path: moved }])
})

test('relocating onto another Project refuses rather than merging the two', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const alpha = await registerProject(register('r1'), setup.store)
  const betaFolder = await repository(setup.root, 'beta')
  setup.choose(betaFolder)
  await registerProject(register('r2'), setup.store)
  setup.choose(betaFolder)
  const reply = await relocateProject(relocate('m1', alpha.projects[0]?.id ?? ''), setup.store)
  assert.equal(reply.code, 'already-registered')
})

test('relocating an unregistered identity never creates one', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  await registerProject(register('r1'), setup.store)
  const reply = await relocateProject(relocate('m1', 'project-unknown'), setup.store)
  assert.equal(reply.code, 'missing-project')
})

test('a registry written while the chooser is open survives the relocation', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const alpha = await registerProject(register('r1'), setup.store)
  const moved = await repository(setup.root, 'alpha-moved')
  setup.choose(moved)
  setup.duringChoice(() => registerElsewhere(setup))
  const projectId = alpha.projects[0]?.id
  const reply = await relocateProject(relocate('m1', projectId), setup.store)
  assert.equal(reply.projects.find((project) => project.id === projectId)?.path, moved)
  assert.equal(reply.projects.length, 2)
})

test('a Project removed while the chooser is open relocates nothing', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const alpha = await registerProject(register('r1'), setup.store)
  setup.choose(await repository(setup.root, 'alpha-moved'))
  // Another window forgets the Project while this chooser is open.
  setup.duringChoice(async () => setup.store.projects.replace({ projects: [] }))
  const reply = await relocateProject(relocate('m1', alpha.projects[0]?.id ?? ''), setup.store)
  assert.equal(reply.code, 'missing-project')
  assert.deepEqual(setup.store.projects.read(), { projects: [] })
})
