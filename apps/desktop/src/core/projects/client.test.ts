import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProjectClient } from './client'
import { PENDING_IMPORT_CATEGORIES, PROJECT_IMPORT_ACTION } from './messages'

const request = { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' }
const opened = {
  version: 1,
  type: 'project.opened',
  requestId: 'open-1',
  project: { id: 'project-1', name: 'example' },
}

test('refuses malformed or unrelated presentation data at the renderer boundary', async () => {
  for (const reply of [
    null,
    { ...opened, version: 2 },
    { ...opened, requestId: 'another-request' },
    { ...opened, project: { ...opened.project, id: 'another-project' } },
    { ...opened, project: { ...opened.project, credential: 'secret' } },
    { ...opened, token: 'secret' },
    {
      version: 1,
      type: 'project.error',
      requestId: 'open-1',
      code: 'internal-error',
      message: 'secret',
    },
  ]) {
    const client = createProjectClient(async () => reply)
    assert.deepEqual(await client.openProject(request), {
      version: 1,
      type: 'project.error',
      requestId: 'open-1',
      code: 'invalid-response',
      message: 'Argo received an invalid Project response.',
    })
  }
})

test('reports a lost application connection without exposing its exception', async () => {
  const client = createProjectClient(async () => {
    throw new Error('credential-secret')
  })
  assert.deepEqual(await client.openProject(request), {
    version: 1,
    type: 'project.error',
    requestId: 'open-1',
    code: 'connection-lost',
    message: 'The connection to Argo was lost.',
  })
})

const listRequest = { version: 1, type: 'project.list', requestId: 'list-1' }
const listed = {
  version: 1,
  type: 'project.listed',
  requestId: 'list-1',
  projects: [{ id: 'project-1', name: 'example', path: '/tmp/example' }],
  selectedId: 'project-1',
}

const invalidResponse = {
  version: 1,
  type: 'project.error',
  requestId: 'list-1',
  code: 'invalid-response',
  message: 'Argo received an invalid Project response.',
}

test('passes a well formed listing through untouched', async () => {
  const client = createProjectClient(async () => listed)
  assert.deepEqual(await client.listProjects(listRequest), listed)
})

test('passes a well formed Project import through untouched', async () => {
  const imported = {
    ...listed,
    type: 'project.imported',
    importedCount: 1,
    pendingCategories: PENDING_IMPORT_CATEGORIES,
  }
  const client = createProjectClient(async () => imported)
  assert.deepEqual(
    await client.importProjects({ version: 1, type: PROJECT_IMPORT_ACTION, requestId: 'list-1' }),
    imported,
  )
})

test('refuses a listing that is malformed or answers another request', async () => {
  for (const reply of [
    { ...listed, requestId: 'another-request' },
    { ...listed, selectedId: 'project-2' },
    { ...listed, projects: [{ id: 'project-1', name: 'example' }] },
    { ...listed, projects: [{ ...listed.projects[0], token: 'secret' }] },
    { ...listed, cursor: 'extra' },
  ]) {
    const client = createProjectClient(async () => reply)
    assert.deepEqual(await client.listProjects(listRequest), invalidResponse)
  }
})

test('every action that can change the known set reads the same replies', async () => {
  const cancelled = { version: 1, type: 'project.cancelled', requestId: 'list-1' }
  const client = createProjectClient(async () => cancelled)
  assert.deepEqual(
    await client.registerProject({ version: 1, type: 'project.register', requestId: 'list-1' }),
    cancelled,
  )
  assert.deepEqual(
    await client.relocateProject({
      version: 1,
      type: 'project.relocate',
      requestId: 'list-1',
      projectId: 'project-1',
    }),
    cancelled,
  )
})
