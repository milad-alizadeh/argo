import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fixture } from './fake-driver/registration-fixture'
import { importProjects, type ProjectImportStore } from './import-projects'
import { PENDING_IMPORT_CATEGORIES, PROJECT_IMPORT_ACTION } from './messages'

const request = (requestId: string) => ({
  version: 1,
  type: PROJECT_IMPORT_ACTION,
  requestId,
})

function importStore(setup): ProjectImportStore {
  return {
    registryPath: setup.store.registryPath,
    sourceRegistryPath: path.join(setup.root, 'userData', 'projects.json'),
  }
}

async function writeSwiftRegistry(
  sourcePath: string,
  projects: unknown[],
  activeProjectId: string | null,
): Promise<void> {
  await mkdir(path.dirname(sourcePath), { recursive: true })
  await writeFile(sourcePath, JSON.stringify({ projects, activeProjectId }))
}

test('imports every legacy Project, preserves Bindings and opens the active Project', async (context) => {
  const setup = await fixture(context)
  const store = importStore(setup)
  const alpha = path.join(setup.root, 'alpha')
  const beta = path.join(setup.root, 'beta')
  await mkdir(alpha)
  await mkdir(beta)
  await writeSwiftRegistry(
    store.sourceRegistryPath,
    [
      {
        id: 'project-alpha',
        path: alpha,
        bindings: [{ port: 'ticket', accountID: 'github:1', scope: 'milad/alpha' }],
      },
      {
        id: 'project-beta',
        path: beta,
        bindings: [{ port: 'codeHost', accountID: 'github:1', scope: 'milad/beta' }],
      },
    ],
    'project-beta',
  )
  const sourceBefore = await readFile(store.sourceRegistryPath, 'utf8')

  const reply = await importProjects(request('import-1'), store)

  assert.deepEqual(reply, {
    version: 1,
    type: 'project.imported',
    requestId: 'import-1',
    projects: [
      { id: 'project-alpha', name: 'alpha', path: alpha },
      { id: 'project-beta', name: 'beta', path: beta },
    ],
    selectedId: 'project-beta',
    importedCount: 2,
    pendingCategories: PENDING_IMPORT_CATEGORIES,
  })
  assert.equal(await readFile(store.sourceRegistryPath, 'utf8'), sourceBefore)
  assert.deepEqual(JSON.parse(await readFile(setup.store.registryPath, 'utf8')), {
    version: 1,
    projects: [
      {
        id: 'project-alpha',
        path: alpha,
        bindings: [{ port: 'ticket', accountID: 'github:1', scope: 'milad/alpha' }],
      },
      {
        id: 'project-beta',
        path: beta,
        bindings: [{ port: 'codeHost', accountID: 'github:1', scope: 'milad/beta' }],
      },
    ],
    selectedId: 'project-beta',
  })
})

test('repeating after an import commits keeps one registration per stable Project ID', async (context) => {
  const setup = await fixture(context)
  const store = importStore(setup)
  const alpha = path.join(setup.root, 'alpha')
  await mkdir(alpha)
  await writeSwiftRegistry(
    store.sourceRegistryPath,
    [{ id: 'project-alpha', path: alpha }],
    'project-alpha',
  )

  await importProjects(request('import-1'), store)
  const repeated = await importProjects(request('import-2'), store)

  assert.equal(repeated.type, 'project.imported')
  assert.equal(repeated.importedCount, 0)
  assert.deepEqual(JSON.parse(await readFile(setup.store.registryPath, 'utf8')).projects, [
    { id: 'project-alpha', path: alpha },
  ])
})

test('retries after an interrupted pending write without reading it as a Project registry', async (context) => {
  const setup = await fixture(context)
  const store = importStore(setup)
  const alpha = path.join(setup.root, 'alpha')
  await mkdir(alpha)
  await writeSwiftRegistry(
    store.sourceRegistryPath,
    [{ id: 'project-alpha', path: alpha }],
    'project-alpha',
  )
  await mkdir(path.dirname(store.registryPath), { recursive: true })
  await writeFile(`${store.registryPath}.interrupted.pending`, '{')

  const reply = await importProjects(request('import-1'), store)

  assert.equal(reply.type, 'project.imported')
  assert.equal(reply.importedCount, 1)
  assert.deepEqual(JSON.parse(await readFile(store.registryPath, 'utf8')).projects, [
    { id: 'project-alpha', path: alpha },
  ])
})
