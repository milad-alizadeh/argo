import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { EMPTY_REGISTRY, readRegistry, toSummary, writeRegistry } from '../src/projects/registry.ts'

async function store(context, content) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-registry-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const registryPath = path.join(root, 'portable-v1', 'projects.json')
  if (content !== undefined) {
    await mkdir(path.dirname(registryPath), { recursive: true })
    await writeFile(registryPath, content)
  }
  return { root, registryPath }
}

const wire = (projects, selectedId) => JSON.stringify({ version: 1, projects, selectedId })

test('a registry that was never written reads as missing, not as broken', async (context) => {
  const { registryPath } = await store(context)
  assert.deepEqual(await readRegistry(registryPath), { ok: false, reason: 'missing' })
})

test('a selection naming a Project that is gone is dropped, not obeyed', async (context) => {
  const { registryPath } = await store(context, wire([{ id: 'a', path: '/tmp/a' }], 'b'))
  assert.deepEqual(await readRegistry(registryPath), {
    ok: true,
    registry: { projects: [{ id: 'a', path: '/tmp/a' }], selectedId: null, other: {} },
  })
})

test('two Projects sharing one identity is corruption, not a duplicate to fix', async (context) => {
  const path1 = { id: 'a', path: '/tmp/a' }
  const { registryPath } = await store(context, wire([path1, { id: 'a', path: '/tmp/b' }], 'a'))
  assert.deepEqual(await readRegistry(registryPath), { ok: false, reason: 'invalid' })
})

test('a relative path is refused, because a Project path is where the repository is', async (context) => {
  const { registryPath } = await store(context, wire([{ id: 'a', path: 'relative/a' }], null))
  assert.deepEqual(await readRegistry(registryPath), { ok: false, reason: 'invalid' })
})

test('a write replaces the file and leaves no half-written one behind', async (context) => {
  const { registryPath } = await store(context, wire([{ id: 'a', path: '/tmp/a' }], 'a'))
  assert.equal(await writeRegistry(registryPath, EMPTY_REGISTRY), true)
  assert.deepEqual(await readRegistry(registryPath), { ok: true, registry: EMPTY_REGISTRY })
  assert.deepEqual(await readdir(path.dirname(registryPath)), ['projects.json'])
})

test('a write that cannot happen answers false rather than throwing', async (context) => {
  const { root } = await store(context)
  await writeFile(path.join(root, 'file'), 'not a directory')
  assert.equal(await writeRegistry(path.join(root, 'file', 'projects.json'), EMPTY_REGISTRY), false)
})

test('fields this workflow does not own survive a write', async (context) => {
  const kept = { id: 'a', path: '/tmp/a', bindings: [{ token: 'must-stay-private' }] }
  const { registryPath } = await store(
    context,
    JSON.stringify({ version: 1, projects: [kept], selectedId: 'a', importedFrom: 'swift' }),
  )
  const read = await readRegistry(registryPath)
  assert.deepEqual(read.registry.projects, [kept])
  assert.deepEqual(read.registry.other, { importedFrom: 'swift' })
  assert.equal(await writeRegistry(registryPath, read.registry), true)
  assert.deepEqual(JSON.parse(await readFile(registryPath, 'utf8')), {
    importedFrom: 'swift',
    version: 1,
    projects: [kept],
    selectedId: 'a',
  })
})

test('the summary names a Project by its folder', () => {
  assert.deepEqual(toSummary({ id: 'a', path: '/tmp/argo' }), {
    id: 'a',
    name: 'argo',
    path: '/tmp/argo',
  })
})
