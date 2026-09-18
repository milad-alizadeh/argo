import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openProject } from '../src/domains/projects/main/open-project.ts'
import { createProjectStore } from '../src/domains/projects/main/sqlite-store.ts'

const request = { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' }

async function fixture(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-project-contract-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const projectPath = path.join(root, 'example')
  await mkdir(projectPath)
  const database = new Database(path.join(root, 'argo.sqlite'))
  const projects = createProjectStore(database)
  projects.replace({
    projects: [
      { id: 'project-1', path: projectPath, commonDirectory: path.join(projectPath, '.git') },
    ],
    selectedId: 'project-1',
  })
  const store = {
    projects,
    chooseFolder: async () => null,
    exclusive: async (work) => work(),
  }
  context.after(() => projects.close())
  return { database, projectPath, store }
}

test('routes an unconfigured Project to setup by stable ID with presentation data only', async (context) => {
  const { store } = await fixture(context)
  assert.deepEqual(await openProject(request, store), {
    version: 1,
    type: 'project.setup-required',
    requestId: 'open-1',
    project: { id: 'project-1', name: 'example' },
  })
})

test('reports a missing Project without treating the identifier as a path', async (context) => {
  const { store, projectPath } = await fixture(context)
  assert.deepEqual(await openProject({ ...request, projectId: projectPath }, store), {
    version: 1,
    type: 'project.error',
    requestId: 'open-1',
    code: 'missing-project',
    message: 'This Project is not registered.',
  })
})

test('reports denied access without exposing the filesystem error', async (context) => {
  const { store, projectPath } = await fixture(context)
  await chmod(projectPath, 0)
  try {
    assert.deepEqual(await openProject(request, store), {
      version: 1,
      type: 'project.error',
      requestId: 'open-1',
      code: 'access-denied',
      message: 'Argo cannot access this Project.',
    })
  } finally {
    await chmod(projectPath, 0o700)
  }
})

test('distinguishes an unavailable registered folder from a missing Project', async (context) => {
  const { store, projectPath } = await fixture(context)
  await rm(projectPath, { recursive: true })
  const reply = await openProject(request, store)
  assert.equal(reply.code, 'project-unavailable')
  assert.equal(reply.requestId, 'open-1')
})

test('refuses a corrupt stored registration without leaking its data', async (context) => {
  const { database, store } = await fixture(context)
  database.prepare('UPDATE project SET path = ? WHERE id = ?').run('relative', 'project-1')
  assert.deepEqual(await openProject(request, store), {
    version: 1,
    type: 'project.error',
    requestId: 'open-1',
    code: 'storage-invalid',
    message: 'The Project registry cannot be read in this format.',
  })
})

test('reports unreadable storage separately from an unknown Project', async (context) => {
  const { store } = await fixture(context)
  const unavailable = {
    ...store,
    projects: {
      ...store.projects,
      read: () => {
        throw new Error()
      },
    },
  }
  assert.equal((await openProject(request, unavailable)).code, 'storage-unavailable')
})
