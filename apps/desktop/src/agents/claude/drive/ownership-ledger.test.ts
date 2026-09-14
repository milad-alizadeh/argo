import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { createOwnershipLedger } from './ownership-ledger'

async function ledgerPath(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-ownership-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return { root, file: path.join(root, 'claude-session-ownership.json') }
}

test('binding a Session claims it here, and releasing it orphans it', async (context) => {
  const { file } = await ledgerPath(context)
  const ledger = createOwnershipLedger({
    path: file,
    owner: { pid: 1, registry: 'a' },
    isAlive: () => true,
  })
  assert.equal(ledger.standing('s1'), 'never-owned')
  ledger.bind('s1')
  assert.equal(ledger.standing('s1'), 'held-here')
  ledger.release('s1')
  assert.equal(ledger.standing('s1'), 'orphaned')
  assert.deepEqual([...ledger.orphans()], ['s1'])
})

test('a Session another live process holds is held elsewhere, not orphaned', async (context) => {
  const { file } = await ledgerPath(context)
  const holder = createOwnershipLedger({
    path: file,
    owner: { pid: 1, registry: 'a' },
    isAlive: () => true,
  })
  holder.bind('s1')
  const other = createOwnershipLedger({
    path: file,
    owner: { pid: 2, registry: 'b' },
    isAlive: (pid) => pid === 1,
  })
  assert.equal(other.standing('s1'), 'held-elsewhere')
})

test('a save replaces the file and leaves no half-written one behind', async (context) => {
  const { file } = await ledgerPath(context)
  const ledger = createOwnershipLedger({
    path: file,
    owner: { pid: 1, registry: 'a' },
    isAlive: () => true,
  })
  ledger.bind('s1')
  assert.deepEqual(await readdir(path.dirname(file)), [path.basename(file)])
})

test('a save that cannot happen still keeps the claim for this launch', async (context) => {
  const { root } = await ledgerPath(context)
  await writeFile(path.join(root, 'blocker'), 'not a directory')
  const file = path.join(root, 'blocker', 'claude-session-ownership.json')
  const ledger = createOwnershipLedger({
    path: file,
    owner: { pid: 1, registry: 'a' },
    isAlive: () => true,
  })
  ledger.bind('s1')
  assert.equal(ledger.standing('s1'), 'held-here')
})
