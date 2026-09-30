import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { initTRPC } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { afterEach, expect, test } from 'vitest'
import { project } from '@/database/project/schema'
import { workspace } from '@/database/workspace/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { workspaceChooseProcedure, workspaceListProcedure } from './api/workspace-list'
import { ensureManagedWorkspace } from './workspace-create-managed'

const run = promisify(execFile)
const temporaryPaths: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-workspace-test-'))
  temporaryPaths.push(root)
  const repository = path.join(root, 'repository')
  await run('git', ['init', '--initial-branch=main', repository])
  await writeFile(path.join(repository, 'README.md'), 'test repository\n')
  await run('git', ['-C', repository, 'add', 'README.md'])
  await run('git', [
    '-C',
    repository,
    '-c',
    'user.name=Argo Test',
    '-c',
    'user.email=argo-test@example.invalid',
    'commit',
    '-m',
    'Initial commit',
  ])
  const database = migratedDatabase()
  const client = database.$client
  const projectId = 'project-workspace-test'
  database
    .insert(project)
    .values({
      id: projectId,
      path: repository,
      commonDirectory: await realpath(path.join(repository, '.git')),
    })
    .run()
  return { root, repository, client, database, projectId }
}

test('creates one linked worktree and reuses it when the draft is submitted again', async () => {
  const { root, client, database, projectId } = await fixture()
  try {
    const input = {
      database,
      projectId,
      draftId: 'draft-one',
      worktreeRoot: path.join(root, 'worktrees'),
    }
    const first = await ensureManagedWorkspace(input)
    const second = await ensureManagedWorkspace(input)
    expect(second).toEqual(first)
    expect(
      (await run('git', ['-C', first.path, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim(),
    ).toMatch(/^argo\/session-/)
    expect(
      database.select().from(workspace).where(eq(workspace.projectId, projectId)).all(),
    ).toMatchObject([{ id: first.id, kind: 'managed', path: first.path }])
  } finally {
    client.close()
  }
})

test('starts with New worktree and remembers an existing checkout choice', async () => {
  const { client, database, projectId } = await fixture()
  try {
    const exclusive = async <T>(work: () => Promise<T>) => work()
    const context = { database, exclusive }
    const router = initTRPC.create().router({
      list: workspaceListProcedure(context),
      choose: workspaceChooseProcedure(context),
    })
    const caller = router.createCaller({})
    const initial = await caller.list({ projectId })
    expect(initial.type).toBe('workspace.listed')
    if (initial.type !== 'workspace.listed') return
    expect(initial.choice).toBe('new')
    const main = initial.workspaces.find((candidate) => candidate.kind === 'main')
    expect(main).toBeDefined()
    if (main === undefined) return
    await caller.choose({ projectId, choice: main.id })
    const restored = await caller.list({ projectId })
    expect(restored.type === 'workspace.listed' ? restored.choice : null).toBe(main.id)
    await expect(
      caller.choose({ projectId, choice: 'workspace-outside-project' }),
    ).rejects.toThrow()
  } finally {
    client.close()
  }
})
