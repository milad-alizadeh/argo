import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { listProjects } from './list-projects'
import { registerProject, relocateProject } from './register-project'
import { fixture, list, register, registerElsewhere, repository } from './fake-driver/registration-fixture'

test('registering a folder creates one Project, selects it and writes it down', async (context) => {
  const setup = await fixture(context)
  const folder = await repository(setup.root, 'alpha')
  setup.choose(folder)
  const reply = await registerProject(register('r1'), setup.store)
  assert.equal(reply.type, 'project.listed')
  assert.deepEqual(reply.projects, [{ id: reply.selectedId, name: 'alpha', path: folder }])
  assert.match(reply.selectedId, /^project-/)
  const stored = JSON.parse(await readFile(setup.store.registryPath, 'utf8'))
  assert.deepEqual(stored, {
    version: 1,
    projects: [{ id: reply.selectedId, path: folder }],
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
  assert.deepEqual((await listProjects(list('l1'), setup.store.registryPath)).projects, [])
})

test('dismissing the chooser writes nothing and says so', async (context) => {
  const setup = await fixture(context)
  setup.choose(null)
  assert.deepEqual(await registerProject(register('r1'), setup.store), {
    version: 1,
    type: 'project.cancelled',
    requestId: 'r1',
  })
  assert.equal((await listProjects(list('l1'), setup.store.registryPath)).projects.length, 0)
})

test('a fresh machine lists an empty cockpit rather than a storage failure', async (context) => {
  const setup = await fixture(context)
  assert.deepEqual(await listProjects(list('l1'), setup.store.registryPath), {
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
  const relaunched = await listProjects(list('l1'), setup.store.registryPath)
  assert.equal(relaunched.selectedId, registered.selectedId)
  assert.deepEqual(relaunched.projects, registered.projects)
})

test('registering keeps the fields another portable client owns', async (context) => {
  const setup = await fixture(context)
  const folder = await repository(setup.root, 'alpha')
  await mkdir(path.dirname(setup.store.registryPath), { recursive: true })
  await writeFile(
    setup.store.registryPath,
    JSON.stringify({
      version: 1,
      importedFrom: 'swift',
      projects: [{ id: 'project-kept', path: folder, bindings: [{ token: 'must-stay-private' }] }],
      selectedId: null,
    }),
  )
  setup.choose(folder)
  const reply = await registerProject(register('r1'), setup.store)
  assert.equal(reply.selectedId, 'project-kept')
  assert.deepEqual(JSON.parse(await readFile(setup.store.registryPath, 'utf8')), {
    importedFrom: 'swift',
    version: 1,
    projects: [{ id: 'project-kept', path: folder, bindings: [{ token: 'must-stay-private' }] }],
    selectedId: 'project-kept',
  })
  // The renderer receives presentation data only, never the fields it does not own.
  assert.deepEqual(reply.projects, [{ id: 'project-kept', name: 'alpha', path: folder }])
})

test('a registry that cannot be read in this format refuses every action', async (context) => {
  const setup = await fixture(context)
  await mkdir(path.dirname(setup.store.registryPath), { recursive: true })
  await writeFile(setup.store.registryPath, '{ not json')
  assert.equal((await registerProject(register('r1'), setup.store)).code, 'storage-invalid')
  assert.equal((await listProjects(list('l1'), setup.store.registryPath)).code, 'storage-invalid')
})

test('an action that is not the one it names is refused', async (context) => {
  const setup = await fixture(context)
  assert.equal(
    (await registerProject({ version: 1, type: 'nope' }, setup.store)).code,
    'invalid-request',
  )
  assert.equal((await relocateProject(register('r1'), setup.store)).code, 'invalid-request')
  assert.equal(
    (await listProjects(register('r1'), setup.store.registryPath)).code,
    'invalid-request',
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
