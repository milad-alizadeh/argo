import { execFile } from 'node:child_process'
import { access, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import { expect, onTestFinished, test } from 'vitest'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { workspace } from '@/database/workspace/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { addLinkedWorktree, workspaceRepoFixture } from '@/mocks/projects/workspace-repo.fixture'
import { ensureManagedWorkspace } from './workspace-create-managed'
import { reapManagedWorkspaces } from './workspace-reap-managed'

const run = promisify(execFile)
const projectId = 'project-1'

function git(folder: string, arguments_: string[]) {
  const identity = ['-c', 'user.name=Argo', '-c', 'user.email=argo@example.test']
  return run('git', ['-C', folder, ...identity, ...arguments_])
}

async function fixture() {
  const { project: repository } = await workspaceRepoFixture({
    after: (cleanup) => onTestFinished(cleanup),
  })
  const database = migratedDatabase()
  onTestFinished(() => database.$client.close())
  database
    .insert(project)
    .values({
      id: projectId,
      path: repository,
      commonDirectory: await realpath(path.join(repository, '.git')),
    })
    .run()
  const managed = await ensureManagedWorkspace({
    database,
    projectId,
    draftId: 'draft-1',
    worktreeRoot: path.join(path.dirname(repository), 'worktrees'),
  })
  const branch = (await git(managed.path, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  return { database, repository, managed, branch }
}

function addSession(
  database: Database,
  input: { id: string; workspaceId: string | null; cwd: string; archived: boolean },
) {
  database
    .insert(sessionTable)
    .values({
      argoId: input.id,
      harness: 'codex',
      nativeId: `native-${input.id}`,
      projectId,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
    })
    .run()
  if (input.archived) database.insert(sessionArchive).values({ sessionId: input.id }).run()
}

function reap(database: Database, live: string[] = []) {
  return reapManagedWorkspaces({ database, hasLiveChannel: (id) => live.includes(id) })
}

async function exists(folder: string) {
  return access(folder).then(
    () => true,
    () => false,
  )
}

async function hasBranch(repository: string, branch: string) {
  return git(repository, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).then(
    () => true,
    () => false,
  )
}

test('removes a clean archived managed worktree and its branch, and keeps the row', async () => {
  const { database, repository, managed, branch } = await fixture()
  addSession(database, {
    id: 'session-1',
    workspaceId: managed.id,
    cwd: managed.path,
    archived: true,
  })

  await expect(reap(database)).resolves.toEqual([{ workspaceId: managed.id, outcome: 'removed' }])
  expect(await exists(managed.path)).toBe(false)
  expect(await hasBranch(repository, branch)).toBe(false)
  expect(database.select().from(workspace).where(eq(workspace.id, managed.id)).all()).toHaveLength(
    1,
  )
})

test('keeps a managed worktree with uncommitted changes', async () => {
  const { database, managed } = await fixture()
  addSession(database, {
    id: 'session-1',
    workspaceId: managed.id,
    cwd: managed.path,
    archived: true,
  })
  await writeFile(path.join(managed.path, 'draft.txt'), 'unsaved\n')

  await expect(reap(database)).resolves.toEqual([{ workspaceId: managed.id, outcome: 'dirty' }])
  expect(await exists(managed.path)).toBe(true)
})

test('keeps a managed worktree whose branch alone holds a commit', async () => {
  const { database, repository, managed, branch } = await fixture()
  addSession(database, {
    id: 'session-1',
    workspaceId: managed.id,
    cwd: managed.path,
    archived: true,
  })
  await git(managed.path, ['commit', '--quiet', '--allow-empty', '-m', 'work'])

  await expect(reap(database)).resolves.toEqual([{ workspaceId: managed.id, outcome: 'unmerged' }])
  expect(await hasBranch(repository, branch)).toBe(true)
})

test('keeps a managed worktree a live channel is using', async () => {
  const { database, managed } = await fixture()
  addSession(database, { id: 'session-1', workspaceId: null, cwd: managed.path, archived: true })

  await expect(reap(database, ['session-1'])).resolves.toEqual([
    { workspaceId: managed.id, outcome: 'in-use' },
  ])
  expect(await exists(managed.path)).toBe(true)
})

test('keeps a managed worktree whose Session is not archived and never pushed', async () => {
  const { database, managed } = await fixture()
  addSession(database, {
    id: 'session-1',
    workspaceId: managed.id,
    cwd: managed.path,
    archived: false,
  })
  addSession(database, {
    id: 'session-2',
    workspaceId: managed.id,
    cwd: managed.path,
    archived: true,
  })

  await expect(reap(database)).resolves.toEqual([
    { workspaceId: managed.id, outcome: 'not-landed' },
  ])
  expect(await exists(managed.path)).toBe(true)
})

test('keeps a managed worktree no Session has used yet', async () => {
  const { database, managed } = await fixture()

  await expect(reap(database)).resolves.toEqual([
    { workspaceId: managed.id, outcome: 'not-landed' },
  ])
})

async function withOrigin(repository: string) {
  const origin = path.join(path.dirname(repository), 'origin.git')
  await run('git', ['clone', '--quiet', '--bare', repository, origin])
  await git(repository, ['remote', 'add', 'origin', origin])
  await git(repository, ['fetch', '--quiet', 'origin'])
  await git(repository, ['remote', 'set-head', 'origin', 'main'])
}

test('removes a pushed managed worktree once the remote default branch contains it', async () => {
  const { database, repository, managed, branch } = await fixture()
  addSession(database, {
    id: 'session-1',
    workspaceId: managed.id,
    cwd: managed.path,
    archived: false,
  })
  await withOrigin(repository)
  await git(managed.path, ['commit', '--quiet', '--allow-empty', '-m', 'work'])
  await git(managed.path, ['push', '--quiet', '-u', 'origin', branch])

  await expect(reap(database)).resolves.toEqual([
    { workspaceId: managed.id, outcome: 'not-landed' },
  ])
  await git(managed.path, ['push', '--quiet', 'origin', `${branch}:main`])
  await expect(reap(database)).resolves.toEqual([{ workspaceId: managed.id, outcome: 'removed' }])
  expect(await exists(managed.path)).toBe(false)
})

test('never reads an imported or main Workspace', async () => {
  const { database, repository, managed } = await fixture()
  const linked = await addLinkedWorktree(repository)
  database
    .insert(workspace)
    .values([
      { id: 'workspace-main', projectId, kind: 'main', displayName: 'Main', path: repository },
      {
        id: 'workspace-imported',
        projectId,
        kind: 'imported',
        displayName: 'linked',
        path: linked,
      },
    ])
    .run()
  addSession(database, {
    id: 'session-1',
    workspaceId: 'workspace-main',
    cwd: repository,
    archived: true,
  })
  addSession(database, {
    id: 'session-2',
    workspaceId: 'workspace-imported',
    cwd: linked,
    archived: true,
  })

  const outcomes = await reap(database)
  expect(outcomes.map((entry) => entry.workspaceId)).toEqual([managed.id])
  expect(await exists(linked)).toBe(true)
  expect(await hasBranch(repository, 'feature')).toBe(true)
})
