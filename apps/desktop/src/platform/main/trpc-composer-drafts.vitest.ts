import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { composerDraft } from '@/database/composer-draft/schema'
import { type Database, databaseMigrationsFolder, openDatabase } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { workspace } from '@/database/workspace/schema'
import {
  type LiveSessionSupervisorActor,
  SessionSubmitRejectedError,
} from '@/domains/sessions/main/live/live-session-supervisor-machine'
import { ensureManagedWorkspace } from '@/domains/workspaces/main/workspace-create-managed'
import { type AppRouterDependencies, createAppRouter } from './trpc-router'

const projectId = 'project-1'
const run = promisify(execFile)
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
    sessions: {
      database,
      supervisor: { send } as LiveSessionSupervisorActor,
      ensureManagedWorkspace: (projectId: string, draftId: string) =>
        exclusive(() =>
          ensureManagedWorkspace({
            database,
            projectId,
            draftId,
            worktreeRoot: path.join(userData, 'worktrees'),
          }),
        ),
      acceptsAttachments: (harness: string) => harness !== 'claude',
    },
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

function addSession(sessionId: string, overrides: Partial<typeof sessionTable.$inferInsert> = {}) {
  database
    .insert(sessionTable)
    .values({
      argoId: sessionId,
      harness: 'codex',
      nativeId: `native-${sessionId}`,
      projectId,
      workspaceId,
      cwd: '/original/repo',
      ...overrides,
    })
    .run()
}

function sessionTarget(sessionId: string) {
  return { type: 'session' as const, sessionId }
}

function createSessionDraft(sessionId: string) {
  addSession(sessionId)
  return caller().composerDraftCreate({ target: sessionTarget(sessionId), content })
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

test('saves a Project draft target without changing its content and sends from that target', async () => {
  database
    .insert(workspace)
    .values({
      id: 'workspace-2',
      projectId,
      kind: 'imported',
      displayName: 'Selected worktree',
      path: '/selected/repo',
    })
    .run()
  const draftContent = { ...content, attachments: [] }
  const created = await caller().composerDraftCreate({
    target: { type: 'project', projectId, workspaceId, harness: 'codex' },
    content: draftContent,
  })
  const target = {
    type: 'project' as const,
    projectId,
    workspaceId: 'workspace-2',
    harness: 'claude' as const,
  }
  const saved = await caller().composerDraftSave({
    id: created.id,
    expectedRevision: created.revision,
    target,
    content: draftContent,
  })
  expect(saved).toMatchObject({ target, revision: 1 })
  await expect(caller().composerDraftRead(created.target)).resolves.toEqual(saved)
  await expect(
    caller().composerDraftSave({
      id: created.id,
      expectedRevision: created.revision,
      target: created.target,
      content,
    }),
  ).rejects.toThrow('stale-draft')

  let submitted: unknown
  const api = caller((event) => {
    if (event.type !== 'Start') throw new Error(`Unexpected event: ${event.type}`)
    submitted = event
    event.reply.resolve({ sessionId: 'session-2' })
  })
  await api.sessionSubmit({
    draftId: saved.id,
    expectedRevision: saved.revision,
    commandId: 'target-only-command',
  })
  expect(submitted).toMatchObject({
    input: { harness: 'claude', workspaceId: 'workspace-2', cwd: '/selected/repo' },
  })
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
    expect(database.select().from(composerDraft).all()).toHaveLength(1)
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
    pendingId: `optimistic:${created.id}:${created.revision}`,
    input: { cwd: '/current/repo', projectId, workspaceId, prompt: content.prompt },
  })
  await expect(api.composerDraftRead(created.target)).resolves.toBeNull()
})

test('creates the selected new worktree before starting a Session', async () => {
  const repository = path.join(userData, 'repository')
  await run('git', ['init', '--initial-branch=main', repository])
  await run('git', ['-C', repository, 'config', 'user.name', 'Argo Test'])
  await run('git', ['-C', repository, 'config', 'user.email', 'argo-test@example.invalid'])
  await writeFile(path.join(repository, 'README.md'), 'test repository\n')
  await run('git', ['-C', repository, 'add', 'README.md'])
  await run('git', ['-C', repository, 'commit', '-m', 'Initial commit'])
  database
    .update(project)
    .set({ path: repository, commonDirectory: path.join(repository, '.git') })
    .where(eq(project.id, projectId))
    .run()
  const created = await caller().composerDraftCreate({
    target: { type: 'project', projectId, workspaceId: null, harness: 'codex' },
    content: { ...content, attachments: [] },
  })
  let submitted: unknown
  const api = caller((event) => {
    if (event.type !== 'Start') throw new Error(`Unexpected event: ${event.type}`)
    submitted = event.input
    event.reply.resolve({ sessionId: 'session-new-worktree' })
  })
  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'new-worktree-command',
    }),
  ).resolves.toEqual({ sessionId: 'session-new-worktree' })
  const managed = database.select().from(workspace).where(eq(workspace.kind, 'managed')).get()
  expect(managed).toBeDefined()
  expect(submitted).toMatchObject({ workspaceId: managed?.id, cwd: managed?.path })
  expect(
    (
      await run('git', ['-C', managed?.path ?? '', 'rev-parse', '--abbrev-ref', 'HEAD'])
    ).stdout.trim(),
  ).toMatch(/^argo\/session-/)
  await expect(api.composerDraftRead(created.target)).resolves.toBeNull()
})

test('retains a newer draft revision when the accepted Session loses the delete race', async () => {
  const created = await createProjectDraft()
  const api = caller((event) => {
    if (event.type !== 'Start') throw new Error(`Unexpected event: ${event.type}`)
    database
      .update(composerDraft)
      .set({ prompt: 'A newer thought.', revision: created.revision + 1 })
      .where(eq(composerDraft.id, created.id))
      .run()
    event.reply.resolve({ sessionId: 'session-1' })
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'command-1',
    }),
  ).rejects.toThrow('stale-draft')
  await expect(api.composerDraftRead(created.target)).resolves.toMatchObject({
    prompt: 'A newer thought.',
    revision: created.revision + 1,
  })
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
  let submissions = 0
  const api = caller(() => {
    submissions += 1
  })
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
  expect(submissions).toBe(0)
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})

test('submits and removes an existing-Session Turn draft', async () => {
  addSession('session-1')
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
    input: {
      sessionId: 'session-1',
      commandId: 'command-1',
      prompt: content.prompt,
      attachments: content.attachments,
      turnConfiguration: content.turnConfiguration,
      resume: {
        harness: 'codex',
        nativeId: 'native-session-1',
        projectId,
        workspaceId,
        cwd: '/original/repo',
      },
    },
  })
  await expect(submittingApi.composerDraftRead(created.target)).resolves.toBeNull()
})

test('retains an existing-Session Turn draft when the supervisor rejects it', async () => {
  const created = await createSessionDraft('session-1')
  const api = caller((event) => {
    if (event.type !== 'Send') throw new Error(`Unexpected event: ${event.type}`)
    event.reply.reject(new Error('Turn failed.'))
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'command-1',
    }),
  ).rejects.toThrow('Turn failed.')
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})

test('reports a definite supervisor rejection and retains the Turn draft', async () => {
  const created = await createSessionDraft('session-1')
  const api = caller((event) => {
    if (event.type !== 'Send') throw new Error(`Unexpected event: ${event.type}`)
    event.reply.reject(new SessionSubmitRejectedError('Turn configuration is unavailable.'))
  })

  await expect(
    api.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'command-1',
    }),
  ).rejects.toMatchObject({
    code: 'PRECONDITION_FAILED',
    message: 'Turn configuration is unavailable.',
  })
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})

test('keeps Session drafts independent and rejects moving one to another owner', async () => {
  addSession('session-1')
  addSession('session-2')
  const api = caller()
  const first = await api.composerDraftCreate({ target: sessionTarget('session-1'), content })
  const second = await api.composerDraftCreate({
    target: sessionTarget('session-2'),
    content: { ...content, prompt: 'Second Session draft.' },
  })
  const saved = await api.composerDraftSave({
    id: first.id,
    expectedRevision: first.revision,
    target: first.target,
    content: { ...content, prompt: 'Saved for first Session.' },
  })

  expect(saved).toMatchObject({ target: sessionTarget('session-1'), revision: 1 })
  await expect(api.composerDraftRead(first.target)).resolves.toEqual(saved)
  await expect(api.composerDraftRead(second.target)).resolves.toEqual(second)
  await expect(
    api.composerDraftSave({
      id: first.id,
      expectedRevision: first.revision,
      target: first.target,
      content,
    }),
  ).rejects.toThrow('stale-draft')
  await expect(api.composerDraftRead(first.target)).resolves.toEqual(saved)
  await expect(
    api.composerDraftSave({
      id: first.id,
      expectedRevision: saved.revision,
      target: second.target,
      content,
    }),
  ).rejects.toThrow('draft-target-cannot-change')
  await expect(
    api.composerDraftSave({
      id: first.id,
      expectedRevision: saved.revision,
      target: { type: 'project', projectId, workspaceId, harness: 'codex' },
      content,
    }),
  ).rejects.toThrow('draft-target-cannot-change')
})

test('round-trips every Session draft content field through SQLite', async () => {
  addSession('session-1')
  const target = sessionTarget('session-1')
  const created = await caller().composerDraftCreate({ target, content })
  const updatedContent = {
    prompt: 'Saved prompt.',
    attachments: [
      { kind: 'file' as const, path: '/repo/readme.md' },
      { kind: 'image' as const, path: '/repo/diagram.png' },
    ],
    ticketContext: [
      {
        id: 'github:argo-42',
        provider: 'github' as const,
        key: 'argo-42',
        title: 'Persist the Session draft',
        status: 'In progress',
        terminal: false,
        blocked: null,
      },
    ],
    turnConfiguration: { model: 'codex-pro', effort: 'medium', mode: 'read-only' },
  }
  const saved = await caller().composerDraftSave({
    id: created.id,
    expectedRevision: created.revision,
    target,
    content: updatedContent,
  })

  expect(saved).toMatchObject({ target, ...updatedContent, revision: 1 })
  await expect(caller().composerDraftRead(target)).resolves.toEqual(saved)
  expect(database.select().from(composerDraft).get()).toMatchObject({
    projectId: null,
    sessionId: 'session-1',
    workspaceId: null,
    harness: null,
  })
})

test('rejects a stale existing-Session submit before sending to the supervisor', async () => {
  addSession('session-1')
  const api = caller()
  const created = await api.composerDraftCreate({ target: sessionTarget('session-1'), content })
  await api.composerDraftSave({
    id: created.id,
    expectedRevision: created.revision,
    target: created.target,
    content: { ...content, prompt: 'Current revision.' },
  })
  let sends = 0
  const submittingApi = caller((event) => {
    if (event.type === 'Send') sends += 1
  })

  await expect(
    submittingApi.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'stale-command',
    }),
  ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED', message: 'stale-draft' })
  expect(sends).toBe(0)
})

test('rejects a missing stored Session without sending or deleting its draft', async () => {
  addSession('session-missing')
  const api = caller()
  const created = await api.composerDraftCreate({
    target: sessionTarget('session-missing'),
    content,
  })
  database.$client.exec('PRAGMA foreign_keys = OFF')
  database.delete(sessionTable).where(eq(sessionTable.argoId, 'session-missing')).run()
  let sends = 0
  const submittingApi = caller(() => {
    sends += 1
  })

  await expect(
    submittingApi.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'missing-session-command',
    }),
  ).rejects.toThrow('missing-session')
  expect(sends).toBe(0)
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})

test('rejects invalid stored JSON for a Session draft at the database interface', async () => {
  addSession('session-1')
  const api = caller()
  const created = await api.composerDraftCreate({ target: sessionTarget('session-1'), content })
  database
    .update(composerDraft)
    .set({ ticketContextJson: '[null]' })
    .where(eq(composerDraft.id, created.id))
    .run()

  await expect(api.composerDraftRead(created.target)).rejects.toThrow()
})

test('keeps a Session draft present until main accepts the command', async () => {
  addSession('session-1')
  const api = caller()
  const created = await api.composerDraftCreate({ target: sessionTarget('session-1'), content })
  let accept!: (value: { sessionId: string }) => void
  const submittingApi = caller((event) => {
    if (event.type !== 'Send') throw new Error(`Unexpected event: ${event.type}`)
    accept = event.reply.resolve
  })

  const submission = submittingApi.sessionSubmit({
    draftId: created.id,
    expectedRevision: created.revision,
    commandId: 'pending-command',
  })
  await Promise.resolve()
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
  accept({ sessionId: 'session-1' })
  await expect(submission).resolves.toEqual({ sessionId: 'session-1' })
  await expect(api.composerDraftRead(created.target)).resolves.toBeNull()
})

test('retains a newer Session revision when an accepted Turn loses the delete race', async () => {
  addSession('session-1')
  const api = caller()
  const created = await api.composerDraftCreate({ target: sessionTarget('session-1'), content })
  const submittingApi = caller((event) => {
    if (event.type !== 'Send') throw new Error(`Unexpected event: ${event.type}`)
    database
      .update(composerDraft)
      .set({ prompt: 'Written while submit was pending.', revision: created.revision + 1 })
      .where(eq(composerDraft.id, created.id))
      .run()
    event.reply.resolve({ sessionId: 'session-1' })
  })

  await expect(
    submittingApi.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'delete-race-command',
    }),
  ).rejects.toThrow('stale-draft')
  await expect(api.composerDraftRead(created.target)).resolves.toMatchObject({
    prompt: 'Written while submit was pending.',
    revision: created.revision + 1,
  })
})

test('rejects unsupported Session attachments before sending to the supervisor', async () => {
  addSession('session-1', { harness: 'claude' })
  const api = caller()
  const created = await api.composerDraftCreate({ target: sessionTarget('session-1'), content })
  let sends = 0
  const submittingApi = caller(() => {
    sends += 1
  })

  await expect(
    submittingApi.sessionSubmit({
      draftId: created.id,
      expectedRevision: created.revision,
      commandId: 'unsupported-attachment',
    }),
  ).rejects.toThrow('This Harness does not accept Session attachments')
  expect(sends).toBe(0)
  await expect(api.composerDraftRead(created.target)).resolves.toEqual(created)
})
