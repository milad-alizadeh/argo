import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'

import { createOwnershipLedger } from './ownership-ledger'

async function ledgerPath(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-ownership-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return path.join(root, 'session-ownership.json')
}

function ledgerAt(file: string, registry: string, alive: number[] = []) {
  return createOwnershipLedger({
    path: file,
    window: { pid: 10, registry },
    isAlive: (pid) => alive.includes(pid),
  })
}

test('binds a Session here and makes it resumable after release', async (context) => {
  const ledger = ledgerAt(await ledgerPath(context), 'window-a', [10])

  assert.equal(ledger.standing('session-1'), 'resumable')
  ledger.bind('session-1')
  assert.equal(ledger.standing('session-1'), 'held-here')
  ledger.release('session-1')
  assert.equal(ledger.standing('session-1'), 'resumable')
})

test('refuses a Session another live window holds', async (context) => {
  const file = await ledgerPath(context)
  ledgerAt(file, 'window-a', [10]).bind('session-1')

  assert.equal(ledgerAt(file, 'window-b', [10]).standing('session-1'), 'held-elsewhere')
})

test('treats a dead owner as resumable', async (context) => {
  const file = await ledgerPath(context)
  ledgerAt(file, 'window-a').bind('session-1')

  assert.equal(ledgerAt(file, 'window-b').standing('session-1'), 'resumable')
})

test('keeps claims from other windows when it binds a Session', async (context) => {
  const file = await ledgerPath(context)
  ledgerAt(file, 'window-a', [10]).bind('session-1')
  ledgerAt(file, 'window-b', [10]).bind('session-2')

  const reread = ledgerAt(file, 'window-c', [10])
  assert.equal(reread.standing('session-1'), 'held-elsewhere')
  assert.equal(reread.standing('session-2'), 'held-elsewhere')
})

test('reads the file after another window resumes a released Session', async (context) => {
  const file = await ledgerPath(context)
  const first = ledgerAt(file, 'window-a', [10])
  const second = ledgerAt(file, 'window-b', [10])
  first.bind('session-1')
  first.release('session-1')
  second.bind('session-1')
  first.bind('session-2')

  assert.equal(first.standing('session-1'), 'held-elsewhere')
})

test('recovers from an unreadable ledger when it binds a Session', async (context) => {
  const file = await ledgerPath(context)
  await writeFile(file, '{ not json')
  const ledger = ledgerAt(file, 'window-a', [10])

  assert.equal(ledger.standing('session-1'), 'resumable')
  ledger.bind('session-1')
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    'session-1': { owner: { pid: 10, registry: 'window-a' } },
  })
})

test('writes only ownership to its durable file', async (context) => {
  const file = await ledgerPath(context)
  const ledger = ledgerAt(file, 'window-a', [10])
  ledger.bind('session-1')
  ledger.bind('session-2')
  ledger.release('session-2')

  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    'session-1': { owner: { pid: 10, registry: 'window-a' } },
    'session-2': { owner: null },
  })
  assert.deepEqual(await readdir(path.dirname(file)), [path.basename(file)])
})

test('keeps a claim in this window when its durable file cannot be written', async (context) => {
  const file = await ledgerPath(context)
  const blocked = path.join(path.dirname(file), 'blocker')
  await writeFile(blocked, 'not a directory')
  const ledger = ledgerAt(path.join(blocked, 'session-ownership.json'), 'window-a', [10])

  assert.doesNotThrow(() => ledger.bind('session-1'))
  assert.equal(ledger.standing('session-1'), 'held-here')
})
