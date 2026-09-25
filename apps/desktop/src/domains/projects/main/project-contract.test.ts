import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { databaseMigrationsFolder } from '@/database/migrations-folder'
import type {
  ProjectError,
  ProjectOpenReply,
  ProjectOpenRequest,
} from '@/domains/projects/contract/contract'
import { openProject } from './open-project'
import { createProjectStore } from './sqlite-store'

const request: ProjectOpenRequest = {
  version: 1,
  type: 'project.open',
  requestId: 'open-1',
  projectId: 'project-1',
}

// The reply is a union, and only its error arm carries a code. A reply of another type is the
// failure the caller is asserting about, so it stops here rather than reading as a wrong code.
function errorReply(reply: ProjectOpenReply): ProjectError {
  assert.equal(reply.type, 'project.error')
  return reply as ProjectError
}

async function fixture(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-project-contract-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const projectPath = path.join(root, 'example')
  await mkdir(projectPath)
  const database = new Database(path.join(root, 'argo.sqlite'))
  migrate(drizzle({ client: database }), { migrationsFolder: databaseMigrationsFolder() })
  const projects = createProjectStore(drizzle({ client: database }))
  projects.replace({
    projects: [
      { id: 'project-1', path: projectPath, commonDirectory: path.join(projectPath, '.git') },
    ],
  })
  const store = {
    projects,
    chooseFolder: async () => null,
    exclusive: async <T>(work: () => Promise<T>) => work(),
  }
  context.after(() => projects.close())
  return { database, projectPath, store }
}

test('opens an unconfigured Project by stable ID with presentation data only', async (context) => {
  const { store } = await fixture(context)
  assert.deepEqual(await openProject(request, store), {
    version: 1,
    type: 'project.opened',
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
    })
  } finally {
    await chmod(projectPath, 0o700)
  }
})

test('distinguishes an unavailable registered folder from a missing Project', async (context) => {
  const { store, projectPath } = await fixture(context)
  await rm(projectPath, { recursive: true })
  const reply = errorReply(await openProject(request, store))
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
  assert.equal(errorReply(await openProject(request, unavailable)).code, 'storage-unavailable')
})
