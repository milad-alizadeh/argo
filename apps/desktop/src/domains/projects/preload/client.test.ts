import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProjectClient } from './client'

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
    const result = await client.openProject({ projectId: 'project-1' })
    assert.equal(result.type, 'project.error')
    assert.equal(result.code, 'invalid-response')
  }
})

test('reports a lost application connection without exposing its exception', async () => {
  const client = createProjectClient(async () => {
    throw new Error('credential-secret')
  })
  const result = await client.openProject({ projectId: 'project-1' })
  assert.equal(result.type, 'project.error')
  assert.equal(result.code, 'connection-lost')
})

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
  const client = createProjectClient(async (_operation, request: { requestId: string }) => ({
    ...listed,
    requestId: request.requestId,
  }))
  const reply = await client.listProjects()
  assert.deepEqual(reply.type === 'project.listed' ? reply.projects : null, listed.projects)
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
    const result = await client.listProjects()
    assert.equal(result.type, invalidResponse.type)
    assert.equal(result.code, invalidResponse.code)
  }
})

test('every action that can change the known set reads the same replies', async () => {
  const client = createProjectClient(async (_operation, request: { requestId: string }) => ({
    version: 1,
    type: 'project.cancelled',
    requestId: request.requestId,
  }))
  assert.deepEqual((await client.registerProject()).type, 'project.cancelled')
  assert.deepEqual(
    (await client.relocateProject({ projectId: 'project-1' })).type,
    'project.cancelled',
  )
})
