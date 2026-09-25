import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import {
  fixture,
  list,
  register,
  registerElsewhere,
  repository,
} from '../../../../mocks/projects/mock-registration'
import { listProjects } from './list-projects'
import { registerProject } from './register-project'

test('registering a folder creates one Project and writes it down', async (context) => {
  const setup = await fixture(context)
  const folder = await repository(setup.root, 'alpha')
  setup.choose(folder)
  const reply = await registerProject(register('r1'), setup.store)
  assert.equal(reply.type, 'project.listed')
  const projectId = reply.projects[0]?.id
  assert.match(projectId ?? '', /^project-/)
  assert.deepEqual(reply.projects, [{ id: projectId, name: 'alpha', path: folder }])
  assert.deepEqual(setup.store.projects.read(), {
    projects: [{ id: projectId, path: folder, commonDirectory: path.join(folder, '.git') }],
  })
})

test('one git root is one Project, however the folder is chosen', async (context) => {
  const setup = await fixture(context)
  const folder = await repository(setup.root, 'alpha')
  setup.choose(folder)
  const first = await registerProject(register('r1'), setup.store)
  const inside = path.join(folder, 'src')
  await mkdir(inside)
  setup.choose(inside)
  const second = await registerProject(register('r2'), setup.store)
  assert.equal(second.projects.length, 1)
})

test('a folder that is not a git repository registers nothing', async (context) => {
  const setup = await fixture(context)
  const plain = path.join(setup.root, 'plain')
  await mkdir(plain)
  setup.choose(plain)
  const reply = await registerProject(register('r1'), setup.store)
  assert.equal(reply.code, 'not-a-repository')
  assert.deepEqual((await listProjects(list('l1'), setup.store)).projects, [])
})

test('dismissing the chooser writes nothing and says so', async (context) => {
  const setup = await fixture(context)
  setup.choose(null)
  assert.deepEqual(await registerProject(register('r1'), setup.store), {
    version: 1,
    type: 'project.cancelled',
    requestId: 'r1',
  })
  assert.equal((await listProjects(list('l1'), setup.store)).projects.length, 0)
})

test('a fresh machine lists an empty cockpit rather than a storage failure', async (context) => {
  const setup = await fixture(context)
  assert.deepEqual(await listProjects(list('l1'), setup.store), {
    version: 1,
    type: 'project.listed',
    requestId: 'l1',
    projects: [],
  })
})

test('listing after registration returns the registered Project', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const registered = await registerProject(register('r1'), setup.store)
  const relaunched = await listProjects(list('l1'), setup.store)
  assert.deepEqual(relaunched.projects, registered.projects)
})

test('does not migrate portable-v1 registrations', async (context) => {
  const setup = await fixture(context)
  const folder = await repository(setup.root, 'alpha')
  const portablePath = path.join(setup.root, 'userData', 'portable-v1', 'projects.json')
  await mkdir(path.dirname(portablePath), { recursive: true })
  const portableData = JSON.stringify({
    version: 1,
    importedFrom: 'swift',
    projects: [{ id: 'project-kept', path: folder, bindings: [{ token: 'must-stay-private' }] }],
  })
  await writeFile(portablePath, portableData)
  setup.choose(folder)
  const reply = await registerProject(register('r1'), setup.store)
  assert.notEqual(reply.projects[0]?.id, 'project-kept')
  assert.deepEqual(reply.projects, [{ id: reply.projects[0]?.id, name: 'alpha', path: folder }])
  assert.equal(await readFile(portablePath, 'utf8'), portableData)
})

test('two registrations started together both land in the registry', async (context) => {
  const setup = await fixture(context)
  const alpha = await repository(setup.root, 'alpha')
  const beta = await repository(setup.root, 'beta')
  setup.chooseEach([alpha, beta])
  await Promise.all([
    registerProject(register('r1'), setup.store),
    registerProject(register('r2'), setup.store),
  ])
  assert.deepEqual(
    setup.store.projects
      .read()
      .projects.map((project) => project.path)
      .sort(),
    [alpha, beta].sort(),
  )
})

test('a registry written while the chooser is open survives the registration', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const alpha = await registerProject(register('r1'), setup.store)
  const beta = await repository(setup.root, 'beta')
  setup.choose(beta)
  setup.duringChoice(() => registerElsewhere(setup))
  const reply = await registerProject(register('r2'), setup.store)
  assert.equal(reply.projects.length, 3)
  assert.ok(reply.projects.some((project) => project.id === 'project-elsewhere'))
})
