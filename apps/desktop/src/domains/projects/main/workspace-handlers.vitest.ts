import assert from 'node:assert/strict'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { createDurableDatabase } from '@/database/durable-database'
import { databaseMigrationsFolder } from '@/database/migrations-folder'
import { openSharedDatabase } from '@/database/shared-database'
import { initFixtureRepo } from '../../../../test-fixtures/projects/workspaces/workspace-repo.fixture'
import { createManagedProjectWorkspace } from './create-managed-project-workspace'
import { listProjectWorkspaces } from './list-project-workspaces'
import type { ProjectStore } from './register-project'
import { selectProjectWorkspace } from './select-project-workspace'
import { createProjectStore } from './sqlite-store'

type ListedReply = { workspaces: { id: string; kind: string }[]; selectedId: string | null }

async function withHandlers(
  handle: (store: Pick<ProjectStore, 'projects'>) => Promise<void>,
): Promise<void> {
  // Reconciliation compares discovered roots by real path (macOS's tmpdir is a symlink), so the
  // fixture resolves its own root the same way, matching workspace-repo.fixture.ts.
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'argo-workspace-handlers-')))
  const { project } = await initFixtureRepo(root)
  const projects = createProjectStore(
    createDurableDatabase(openSharedDatabase(root, databaseMigrationsFolder())),
  )
  projects.replace({
    projects: [{ id: 'project-1', path: project, commonDirectory: path.join(project, '.git') }],
  })
  try {
    await handle({ projects })
  } finally {
    projects.close()
    await rm(root, { recursive: true, force: true })
  }
}

test('lists the main checkout with no prior selection', async () => {
  await withHandlers(async (store) => {
    const reply = (await listProjectWorkspaces(
      { version: 1, type: 'project.workspace.list', requestId: 'r1', projectId: 'project-1' },
      store,
    )) as ListedReply

    assert.equal(reply.workspaces.length, 1)
    assert.equal(reply.selectedId, null)
  })
})

test('refuses to list Workspaces for an unknown Project', async () => {
  await withHandlers(async (store) => {
    const reply = await listProjectWorkspaces(
      { version: 1, type: 'project.workspace.list', requestId: 'r1', projectId: 'missing' },
      store,
    )

    assert.deepEqual(reply, {
      version: 1,
      type: 'project.error',
      requestId: 'r1',
      code: 'missing-project',
    })
  })
})

test('creating a managed Workspace selects it and grows the listing', async () => {
  await withHandlers(async (store) => {
    const reply = (await createManagedProjectWorkspace(
      {
        version: 1,
        type: 'project.workspace.createManaged',
        requestId: 'r1',
        projectId: 'project-1',
        baseRef: 'main',
      },
      store,
    )) as ListedReply

    assert.equal(reply.workspaces.length, 2)
    assert.equal(reply.selectedId, reply.workspaces.find((w) => w.kind === 'managed')?.id)
  })
})

test('selecting a Workspace persists across a later list', async () => {
  await withHandlers(async (store) => {
    const created = (await createManagedProjectWorkspace(
      {
        version: 1,
        type: 'project.workspace.createManaged',
        requestId: 'r1',
        projectId: 'project-1',
        baseRef: 'main',
      },
      store,
    )) as ListedReply
    const mainId = created.workspaces.find((w) => w.kind === 'main')?.id
    assert.ok(mainId)

    await selectProjectWorkspace(
      {
        version: 1,
        type: 'project.workspace.select',
        requestId: 'r2',
        projectId: 'project-1',
        workspaceId: mainId,
      },
      store,
    )
    const reply = (await listProjectWorkspaces(
      { version: 1, type: 'project.workspace.list', requestId: 'r3', projectId: 'project-1' },
      store,
    )) as ListedReply

    assert.equal(reply.selectedId, mainId)
  })
})

test('selecting an unknown Workspace refuses with missing-workspace', async () => {
  await withHandlers(async (store) => {
    const reply = await selectProjectWorkspace(
      {
        version: 1,
        type: 'project.workspace.select',
        requestId: 'r1',
        projectId: 'project-1',
        workspaceId: 'workspace-does-not-exist',
      },
      store,
    )

    assert.deepEqual(reply, {
      version: 1,
      type: 'project.error',
      requestId: 'r1',
      code: 'missing-workspace',
    })
  })
})
