import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openProject } from '../src/projects/open-project.ts'

const request = { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' }

async function fixture(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-project-contract-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const projectPath = path.join(root, 'example')
  await mkdir(projectPath)
  const registryPath = path.join(root, 'projects.json')
  await writeFile(
    registryPath,
    JSON.stringify({
      version: 1,
      projects: [{ id: 'project-1', path: projectPath }],
    }),
  )
  return { projectPath, registryPath }
}

test('opens a registered Project by stable ID with presentation data only', async (context) => {
  const { registryPath } = await fixture(context)
  assert.deepEqual(await openProject(request, registryPath), {
    version: 1,
    type: 'project.opened',
    requestId: 'open-1',
    project: { id: 'project-1', name: 'example' },
  })
})

test('reports a missing Project without treating the identifier as a path', async (context) => {
  const { registryPath, projectPath } = await fixture(context)
  assert.deepEqual(await openProject({ ...request, projectId: projectPath }, registryPath), {
    version: 1,
    type: 'project.error',
    requestId: 'open-1',
    code: 'missing-project',
    message: 'This Project is not registered.',
  })
})

test('reports denied access without exposing the filesystem error', async (context) => {
  const { registryPath, projectPath } = await fixture(context)
  await chmod(projectPath, 0)
  try {
    assert.deepEqual(await openProject(request, registryPath), {
      version: 1,
      type: 'project.error',
      requestId: 'open-1',
      code: 'access-denied',
      message: 'Argo cannot access this Project.',
    })
  } finally {
    await chmod(projectPath, 0o700)
  }
})

test('rejects malformed or unsupported actions before reading storage', async () => {
  const cases = [
    [null, 'invalid-request', null],
    [{ ...request, requestId: '' }, 'invalid-request', null],
    [{ ...request, requestId: 'open-\u0080' }, 'invalid-request', null],
    [{ ...request, projectId: 'project-\u0085' }, 'invalid-request', 'open-1'],
    [{ ...request, version: 2 }, 'unsupported-version', 'open-1'],
    [{ ...request, type: 'process.spawn' }, 'invalid-request', 'open-1'],
    [{ ...request, path: '/private' }, 'invalid-request', 'open-1'],
    [{ ...request, projectId: 42 }, 'invalid-request', 'open-1'],
  ]
  for (const [value, code, requestId] of cases) {
    const reply = await openProject(value, '/does-not-exist/projects.json')
    assert.equal(reply.type, 'project.error')
    assert.equal(reply.code, code)
    assert.equal(reply.requestId, requestId)
  }
})

test('distinguishes an unavailable registered folder from a missing Project', async (context) => {
  const { registryPath, projectPath } = await fixture(context)
  await rm(projectPath, { recursive: true })
  const reply = await openProject(request, registryPath)
  assert.equal(reply.code, 'project-unavailable')
  assert.equal(reply.requestId, 'open-1')
})

test('refuses corrupt or ambiguous stored registrations without leaking their data', async (context) => {
  const { registryPath, projectPath } = await fixture(context)
  const project = { id: 'project-1', path: projectPath }
  for (const content of [
    '{credential-secret',
    JSON.stringify({ version: 2, projects: [project] }),
    JSON.stringify({ version: 1, projects: [project, project] }),
    JSON.stringify({ version: 1, projects: [{ ...project, path: 'relative' }] }),
  ]) {
    await writeFile(registryPath, content)
    assert.deepEqual(await openProject(request, registryPath), {
      version: 1,
      type: 'project.error',
      requestId: 'open-1',
      code: 'storage-invalid',
      message: 'The Project registry cannot be read in this format.',
    })
  }
})

test('reports unreadable storage separately from an unknown Project', async (context) => {
  const { registryPath } = await fixture(context)
  await chmod(registryPath, 0)
  try {
    assert.equal((await openProject(request, registryPath)).code, 'storage-unavailable')
  } finally {
    await chmod(registryPath, 0o600)
  }
  await rm(registryPath)
  assert.equal((await openProject(request, registryPath)).code, 'storage-unavailable')
})
