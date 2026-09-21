import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { createProjectSetupRegistry } from '@/domains/projects/main/setup/persistence/project-setup-registry'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { openSharedDatabase } from '@/platform/main/storage/shared-database'
import { SETUP_DOCUMENT_REVISION } from '../../../../test-fixtures/projects/setup-document.fixture'

const migrationsFolder = path.resolve(import.meta.dirname, '../../../../drizzle')

function openStore(userData: string) {
  const database = openSharedDatabase(userData, migrationsFolder)
  return { database, store: createProjectStore(database) }
}

async function temporaryUserData(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'argo-project-store-'))
}

test('keeps registered Projects and the selected Project after the store reopens', async () => {
  const userData = await temporaryUserData()
  try {
    const { store: first } = openStore(userData)
    first.replace({
      projects: [{ id: 'project-1', path: '/tmp/example', commonDirectory: '/tmp/example/.git' }],
      selectedId: 'project-1',
    })
    first.close()

    const { store: reopened } = openStore(userData)
    assert.deepEqual(reopened.read(), {
      projects: [{ id: 'project-1', path: '/tmp/example', commonDirectory: '/tmp/example/.git' }],
      selectedId: 'project-1',
    })
    reopened.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('refuses a Project row that does not meet the durable-store contract', async () => {
  const userData = await temporaryUserData()
  try {
    const { database, store } = openStore(userData)
    database
      .prepare('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
      .run('project-1', 'relative', '/tmp/example/.git')
    assert.throws(() => store.read())
    store.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('keeps a setup checkpoint after the store reopens', async () => {
  const userData = await temporaryUserData()
  try {
    const { store: first } = openStore(userData)
    first.replace({
      projects: [{ id: 'project-1', path: '/tmp/project', commonDirectory: '/tmp/project/.git' }],
      selectedId: 'project-1',
    })
    first.writeSetupCheckpoint({
      projectId: 'project-1',
      worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
      phase: 'editing',
      configurationSource: '{"version":1}\n',
      documentRevision: SETUP_DOCUMENT_REVISION,
    })
    first.close()

    const { store: reopened } = openStore(userData)
    assert.deepEqual(reopened.readSetupCheckpoint('project-1'), {
      projectId: 'project-1',
      worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
      phase: 'editing',
      configurationSource: '{"version":1}\n',
      documentRevision: SETUP_DOCUMENT_REVISION,
    })
    reopened.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('restores a revisioned Project setup actor from SQLite', async () => {
  const userData = await temporaryUserData()
  try {
    const { store: first } = openStore(userData)
    first.insertProject({
      id: 'project-1',
      path: '/tmp/project',
      commonDirectory: '/tmp/project/.git',
    })
    const setup = createProjectSetupRegistry(first)
    setup.command({
      commandId: 'finish-later',
      event: { type: 'Defer' },
      expectedRevision: 0,
      projectId: 'project-1',
    })
    first.close()

    const { store: reopenedStore } = openStore(userData)
    const reopened = createProjectSetupRegistry(reopenedStore)
    assert.deepEqual(reopened.snapshot('project-1'), {
      projectId: 'project-1',
      revision: 1,
      screen: 'deferred',
      manualSource: '',
      attempt: null,
      questions: [],
      plan: null,
      acceptedPlan: null,
      progress: [],
      finalDiff: null,
      activeEffect: null,
      recoveryMessage: null,
      pendingApproval: null,
    })
    reopenedStore.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('updates a Project path without discarding its setup checkpoint', async () => {
  const userData = await temporaryUserData()
  try {
    const { store } = openStore(userData)
    store.replace({
      projects: [{ id: 'project-1', path: '/tmp/project', commonDirectory: '/tmp/project/.git' }],
      selectedId: 'project-1',
    })
    store.writeSetupCheckpoint({
      projectId: 'project-1',
      worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
      phase: 'ready',
      configurationSource: '{"version":1}\n',
      documentRevision: SETUP_DOCUMENT_REVISION,
    })

    store.updateProjectPath('project-1', '/tmp/project/.argo/worktrees/setup-project-1')

    assert.equal(store.read().projects[0]?.path, '/tmp/project/.argo/worktrees/setup-project-1')
    assert.equal(store.readSetupCheckpoint('project-1')?.phase, 'ready')
    store.close()
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
