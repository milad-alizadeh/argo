import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProjectClient } from '../src/projects/client.ts'

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
