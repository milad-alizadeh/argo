import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { composerDraft } from '@/database/composer-draft/schema'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { workspace } from '@/database/workspace/schema'
import type { LiveSessionSupervisorActor } from '@/domains/sessions/main/live/live-session-supervisor-machine'
import { type AppRouterDependencies, createAppRouter } from './trpc-router'

const projectId = 'project-1'
const workspaceId = 'workspace-1'
const content = {
  prompt: 'Keep this thought.',
  attachments: [{ kind: 'file' as const, path: '/repo/notes.md' }],
  ticketContext: [],
  turnConfiguration: { model: 'gpt-6', effort: 'high', mode: 'workspace-write' },
}

let userData: string
let database: Database

beforeEach(async () => {
  userData = await mkdtemp(path.join(os.tmpdir(), 'argo-composer-draft-'))
  database = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() })
  database
    .insert(project)
    .values({ id: projectId, path: '/repo', commonDirectory: '/repo/.git' })
    .run()
  database
    .insert(workspace)
    .values({
      id: workspaceId,
      projectId,
      kind: 'main',
      displayName: 'Main checkout',
      path: '/current/repo',
    })
    .run()
})

afterEach(async () => {
  database.$client.close()
  await rm(userData, { recursive: true, force: true })
})

function caller(send: LiveSessionSupervisorActor['send'] = () => {}) {
  const exclusive = async <T>(work: () => Promise<T>) => work()
  const dependencies = {
    projects: { database, chooseFolder: async () => null, exclusive },
    sessions: { database, supervisor: { send } as LiveSessionSupervisorActor },
    workspaces: { database, exclusive },
  } as unknown as AppRouterDependencies
  return createAppRouter(dependencies).createCaller({})
}

async function createProjectDraft() {
  return caller().composerDraftCreate({
    target: { type: 'project', projectId, workspaceId, harness: 'codex' },
    content,
  })
}

test('creates, reads, saves, and rejects a stale draft revision', async () => {
  const created = await createProjectDraft()
  await expect(caller().composerDraftRead(created.target)).resolves.toEqual(created)

  const saved = await caller().composerDraftSave({
    id: created.id,
    expectedRevision: created.revision,
    target: created.target,
    content: { ...content, prompt: 'A newer thought.' },
  })
  expect(saved).toMatchObject({ prompt: 'A newer thought.', revision: 1 })
  await expect(
    caller().composerDraftSave({
      id: created.id,
      expectedRevision: created.revision,
      target: created.target,
      content,
    }),
  ).rejects.toThrow('stale-draft')
})

test('rejects invalid stored draft JSON at the database interface', async () => {
  const created = await createProjectDraft()
  database
    .update(composerDraft)
    .set({ attachmentsJson: '{broken' })
    .where(eq(composerDraft.id, created.id))
    .run()

  await expect(caller().composerDraftRead(created.target)).rejects.toThrow()
})

test('resolves the Workspace path in main and deletes an accepted new-Session draft', async () => {
  const created = await createProjectDraft()
  let submitted: unknown
  const api = caller((event) => {
    if (event.type !== 'Start') throw new Error(`Unexpected event: ${event.type}`)
    submitted = event
    event.reply.resolve({ sessionId: 'session-1' })
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'command-1',
    }),
  ).resolves.toEqual({ sessionId: 'session-1' })
  expect(submitted).toMatchObject({
    pendingId: `optimistic:${created.id}`,
    input: { cwd: '/current/repo', projectId, workspaceId, prompt: content.prompt },
  })
  await expect(api.composerDraftRead(created.target)).resolves.toBeNull()
})

test('retains a new-Session draft after submission fails', async () => {
  const created = await createProjectDraft()
  const api = caller((event) => {
    if (event.type === 'Start') event.reply.reject(new Error('Harness failed.'))
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'command-1',
    }),
  ).rejects.toThrow('Harness failed.')
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})

test('rejects stale submission before the Session supervisor receives it', async () => {
  const created = await createProjectDraft()
  let submissions = 0
  const api = caller(() => {
    submissions += 1
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision + 1,
      commandId: 'command-1',
    }),
  ).rejects.toThrow('stale-draft')
  expect(submissions).toBe(0)
})

test('rejects a Workspace that does not belong to the draft Project', async () => {
  database
    .insert(project)
    .values({ id: 'project-2', path: '/other', commonDirectory: '/other/.git' })
    .run()
  database
    .insert(workspace)
    .values({
      id: 'workspace-2',
      projectId: 'project-2',
      kind: 'main',
      displayName: 'Other checkout',
      path: '/other',
    })
    .run()
  const api = caller()
  const created = await api.composerDraftCreate({
    target: { type: 'project', projectId, workspaceId: 'workspace-2', harness: 'codex' },
    content,
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'command-1',
    }),
  ).rejects.toThrow('workspace-not-in-project')
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})

test('submits and removes an existing-Session Turn draft', async () => {
  database
    .insert(sessionTable)
    .values({
      argoId: 'session-1',
      harness: 'codex',
      nativeId: 'native-1',
      projectId,
      workspaceId,
      cwd: '/original/repo',
    })
    .run()
  const api = caller()
  const created = await api.composerDraftCreate({
    target: { type: 'session', sessionId: 'session-1' },
    content,
  })
  let submitted: unknown
  const submittingApi = caller((event) => {
    if (event.type !== 'Send') throw new Error(`Unexpected event: ${event.type}`)
    submitted = event
    event.reply.resolve({ sessionId: 'session-1' })
  })

  await submittingApi.sessionSubmit({
    draftId: created.id,
    expectedRevision: created.revision,
    commandId: 'command-1',
  })
  expect(submitted).toMatchObject({
    input: { sessionId: 'session-1', prompt: content.prompt },
  })
  await expect(submittingApi.composerDraftRead(created.target)).resolves.toBeNull()
})
