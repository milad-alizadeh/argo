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
} from '../../../mocks/projects/mock-registration'
import { listProjects } from './list-projects'
import { registerProject } from './register-project'

test('registering a folder creates one Project, selects it and writes it down', async (context) => {
  const setup = await fixture(context)
  const folder = await repository(setup.root, 'alpha')
  setup.choose(folder)
  const reply = await registerProject(register('r1'), setup.store)
  assert.equal(reply.type, 'project.listed')
  assert.deepEqual(reply.projects, [{ id: reply.selectedId, name: 'alpha', path: folder }])
  assert.match(reply.selectedId, /^project-/)
  assert.deepEqual(setup.store.projects.read(), {
    projects: [{ id: reply.selectedId, path: folder, commonDirectory: path.join(folder, '.git') }],
    selectedId: reply.selectedId,
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
  assert.equal(second.selectedId, first.selectedId)
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
    selectedId: null,
  })
})

test('the next launch lists the Project that was open', async (context) => {
  const setup = await fixture(context)
  setup.choose(await repository(setup.root, 'alpha'))
  const registered = await registerProject(register('r1'), setup.store)
  const relaunched = await listProjects(list('l1'), setup.store)
  assert.equal(relaunched.selectedId, registered.selectedId)
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
    selectedId: null,
  })
  await writeFile(portablePath, portableData)
  setup.choose(folder)
  const reply = await registerProject(register('r1'), setup.store)
  assert.notEqual(reply.selectedId, 'project-kept')
  assert.deepEqual(reply.projects, [{ id: reply.selectedId, name: 'alpha', path: folder }])
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
  assert.deepEqual(
    reply.projects.map((project) => project.id).sort(),
    [alpha.selectedId, 'project-elsewhere', reply.selectedId].sort(),
  )
})
