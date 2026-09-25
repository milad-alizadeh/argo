import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { createDurableDatabase } from '@/database/durable-database'
import { databaseMigrationsFolder } from '@/database/migrations-folder'
import { openSharedDatabase } from '@/database/shared-database'
import { createProjectStore, type ProjectStore } from '../sqlite-store'

function writeWorkspaces(store: ProjectStore): void {
  store.replace({
    projects: [{ id: 'project-1', path: '/tmp/project', commonDirectory: '/tmp/project/.git' }],
    selectedId: 'project-1',
  })
  store.writeWorkspace({
    id: 'workspace-main',
    projectId: 'project-1',
    kind: 'main',
    displayName: 'Main checkout',
    path: '/tmp/project',
    baseRef: 'origin/main',
  })
  store.writeWorkspace({
    id: 'workspace-managed',
    projectId: 'project-1',
    kind: 'managed',
    displayName: 'Argo work',
    path: '/tmp/project/.argo/worktrees/argo-work',
    baseRef: 'origin/main',
  })
  store.selectWorkspace('project-1', 'workspace-managed')
  store.writeManagedWorkspaceRecovery({
    workspaceId: 'workspace-managed',
    checkoutRemovedAt: '2026-09-21T17:37:14.000Z',
  })
}

test('keeps Project-owned Workspaces, selection, and managed recovery after restart', async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-workspace-store-'))
  try {
    const first = createProjectStore(
      createDurableDatabase(openSharedDatabase(userData, databaseMigrationsFolder())),
    )
    writeWorkspaces(first)
    assert.throws(() =>
      first.writeManagedWorkspaceRecovery({
        workspaceId: 'workspace-main',
        checkoutRemovedAt: '2026-09-21T17:37:14.000Z',
      }),
    )
    first.close()
    const reopened = createProjectStore(
      createDurableDatabase(openSharedDatabase(userData, databaseMigrationsFolder())),
    )
    assert.equal(reopened.readWorkspaces('project-1').length, 2)
    assert.equal(reopened.readWorkspaceSelection('project-1'), 'workspace-managed')
    assert.deepEqual(reopened.readManagedWorkspaceRecovery('workspace-managed'), {
      workspaceId: 'workspace-managed',
      checkoutRemovedAt: '2026-09-21T17:37:14.000Z',
    })
    reopened.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
