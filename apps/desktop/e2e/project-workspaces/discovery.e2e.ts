// Discovery, selection, restart, missing paths, and branch changes for a Project's Workspace
// registry (#2600), each proven against the packaged app through the preload surface alone.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import type { ElectronApplication, Page } from 'playwright-core'
import { packagedFixture } from '../packaged-fixture'
import { test as packagedTest } from '../packaged-proof'
import { addLinkedWorktree, launch, prepare } from './fixtures/workspace-project.fixture'

const run = promisify(execFile)

type WorkspaceRun = {
  application: ElectronApplication
  page: Page
  fixture: Awaited<ReturnType<typeof prepare>>
}

const test = packagedTest.extend<{ workspaces: WorkspaceRun }>({
  workspaces: packagedFixture(prepare, launch, (page) =>
    page.waitForFunction(() => typeof window.argo?.listProjectWorkspaces === 'function'),
  ),
})

const list = (page: Page) =>
  page.evaluate(() => window.argo.listProjectWorkspaces({ projectId: 'project-1' }))
const select = (page: Page, workspaceId: string) =>
  page.evaluate(
    (id) => window.argo.selectProjectWorkspace({ projectId: 'project-1', workspaceId: id }),
    workspaceId,
  )
const createManaged = (page: Page) =>
  page.evaluate(() =>
    window.argo.createManagedProjectWorkspace({ projectId: 'project-1', baseRef: 'main' }),
  )

test('discovers the main checkout with no prior selection', async ({ workspaces }) => {
  const reply = await list(workspaces.page)
  assert.equal(reply.type, 'project.workspace.listed')
  assert.equal(reply.type === 'project.workspace.listed' && reply.workspaces.length, 1)
  assert.equal(
    reply.type === 'project.workspace.listed' && reply.workspaces[0]?.kind === 'main',
    true,
  )
  assert.equal(reply.type === 'project.workspace.listed' && reply.selectedId, null)
})

test('imports an externally created linked worktree', async ({ workspaces }) => {
  const linked = path.join(path.dirname(workspaces.fixture.projectPath), 'linked')
  await addLinkedWorktree(workspaces.fixture.projectPath, linked, 'feature')

  const reply = await list(workspaces.page)

  assert.equal(reply.type, 'project.workspace.listed')
  const imported =
    reply.type === 'project.workspace.listed'
      ? reply.workspaces.find((workspace) => workspace.kind === 'imported')
      : undefined
  assert.equal(imported?.path, linked)
  assert.equal(imported?.facts.branch, 'feature')
})

test('creating a managed Workspace selects it, and selection survives a restart', async ({
  workspaces,
}) => {
  const created = await createManaged(workspaces.page)
  assert.equal(created.type, 'project.workspace.listed')
  const managedId = created.type === 'project.workspace.listed' ? created.selectedId : null
  assert.ok(managedId)
  assert.equal(
    created.type === 'project.workspace.listed' &&
      created.workspaces.find((workspace) => workspace.id === managedId)?.kind,
    'managed',
  )
  await workspaces.application.close()

  const restarted = await launch(workspaces.fixture)
  try {
    const page = await restarted.firstWindow()
    await page.waitForFunction(() => typeof window.argo?.listProjectWorkspaces === 'function')
    const reply = await list(page)
    assert.equal(reply.type === 'project.workspace.listed' && reply.selectedId, managedId)
  } finally {
    await restarted.close()
  }
})

test('a managed Workspace whose checkout vanished is still listed, not lost', async ({
  workspaces,
}) => {
  const created = await createManaged(workspaces.page)
  assert.equal(created.type, 'project.workspace.listed')
  const managed =
    created.type === 'project.workspace.listed'
      ? created.workspaces.find((workspace) => workspace.kind === 'managed')
      : undefined
  assert.ok(managed)
  await run('rm', ['-rf', managed.path])

  const reply = await list(workspaces.page)

  assert.equal(reply.type, 'project.workspace.listed')
  const stillListed =
    reply.type === 'project.workspace.listed'
      ? reply.workspaces.find((workspace) => workspace.id === managed.id)
      : undefined
  assert.equal(stillListed?.id, managed.id)
})

test('a branch checkout inside a Workspace never changes its identity', async ({ workspaces }) => {
  const linked = path.join(path.dirname(workspaces.fixture.projectPath), 'linked')
  await addLinkedWorktree(workspaces.fixture.projectPath, linked, 'feature')
  const before = await list(workspaces.page)
  const beforeImported =
    before.type === 'project.workspace.listed'
      ? before.workspaces.find((workspace) => workspace.kind === 'imported')
      : undefined
  assert.ok(beforeImported)

  await run('git', ['-C', linked, 'checkout', '-b', 'renamed'])
  const after = await list(workspaces.page)
  const afterImported =
    after.type === 'project.workspace.listed'
      ? after.workspaces.find((workspace) => workspace.kind === 'imported')
      : undefined

  assert.equal(afterImported?.id, beforeImported.id)
  assert.equal(afterImported?.facts.branch, 'renamed')
})

test('selecting a Workspace that does not exist refuses', async ({ workspaces }) => {
  const reply = await select(workspaces.page, 'workspace-does-not-exist')
  assert.equal(reply.type, 'project.error')
  assert.equal(reply.type === 'project.error' && reply.code, 'missing-workspace')
})
