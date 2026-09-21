import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { observeSourceFingerprints } from './source-fingerprints'

test('observes the live source file rather than trusting a plan fingerprint', async (context) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'argo-source-fingerprints-'))
  context.after(() => rm(projectRoot, { force: true, recursive: true }))
  await writeFile(path.join(projectRoot, 'package.json'), '{"name":"first"}')
  const fingerprint = createHash('sha256').update('{"name":"first"}').digest('hex')

  assert.deepEqual(await observeSourceFingerprints(projectRoot, { 'package.json': fingerprint }), {
    kind: 'current',
  })

  await writeFile(path.join(projectRoot, 'package.json'), '{"name":"changed"}')
  assert.deepEqual(await observeSourceFingerprints(projectRoot, { 'package.json': fingerprint }), {
    kind: 'drifted',
    reason: 'Source changed: package.json',
  })
})

test('refuses a fingerprint that escapes the Project', async (context) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'argo-source-fingerprints-'))
  context.after(() => rm(projectRoot, { force: true, recursive: true }))

  assert.deepEqual(await observeSourceFingerprints(projectRoot, { '../outside': 'hash' }), {
    kind: 'drifted',
    reason: 'Invalid source path: ../outside',
  })
})
