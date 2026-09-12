import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fixture } from './fake-driver/registration-fixture'
import { importProjects, type ProjectImportStore } from './import-projects'
import { PROJECT_IMPORT_ACTION } from './messages'

const request = (requestId: string) => ({ version: 1, type: PROJECT_IMPORT_ACTION, requestId })

function importStore(setup): ProjectImportStore {
  return {
    registryPath: setup.store.registryPath,
    sourceRegistryPath: path.join(setup.root, 'userData', 'projects.json'),
  }
}

async function writeSwiftRegistry(sourcePath: string, projects: unknown[]): Promise<void> {
  await mkdir(path.dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, JSON.stringify({ projects, activeProjectId: 'project-alpha' }))
}

test('does not write the destination when legacy data is partly readable', async (context) => {
  const setup = await fixture(context)
  const store = importStore(setup)
  await mkdir(path.dirname(store.registryPath), { recursive: true })
  await writeFile(
    store.registryPath,
    JSON.stringify({ version: 1, projects: [], selectedId: null }),
  )
  await writeSwiftRegistry(store.sourceRegistryPath, [
    { id: 'project-alpha', path: path.join(setup.root, 'alpha') },
    { id: 'broken' },
  ])
  const before = await readFile(store.registryPath, 'utf8')

  const reply = await importProjects(request('import-1'), store)

  assert.equal(reply.code, 'import-needs-attention')
  assert.equal(await readFile(store.registryPath, 'utf8'), before)
})

test('does not choose between an existing destination Project and a legacy conflict', async (context) => {
  const setup = await fixture(context)
  const store = importStore(setup)
  const oldPath = path.join(setup.root, 'old')
  const destinationPath = path.join(setup.root, 'destination')
  await mkdir(path.dirname(store.registryPath), { recursive: true })
  await writeFile(
    store.registryPath,
    JSON.stringify({
      version: 1,
      projects: [{ id: 'project-alpha', path: destinationPath }],
      selectedId: 'project-alpha',
    }),
  )
  await writeSwiftRegistry(store.sourceRegistryPath, [{ id: 'project-alpha', path: oldPath }])
  const before = await readFile(store.registryPath, 'utf8')

  const reply = await importProjects(request('import-1'), store)

  assert.equal(reply.code, 'import-needs-attention')
  assert.equal(await readFile(store.registryPath, 'utf8'), before)
})
