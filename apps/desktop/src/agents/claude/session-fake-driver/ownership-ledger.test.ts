import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

import { createOwnershipLedger } from '../drive/ownership-ledger.ts'
import { ledgerFile as ledgerPath } from './claude-driver-launch.ts'

function ledgerAt(file: string, owner: { pid: number; registry: string }, alive: number[] = []) {
  return createOwnershipLedger({ path: file, owner, isAlive: (pid) => alive.includes(pid) })
}

test('reads a Session no Argo ever held as resumable', async (context) => {
  const ledger = ledgerAt(await ledgerPath(context), { pid: 10, registry: 'window-a' })

  assert.equal(ledger.standing('never-seen'), 'resumable')
})

test('reads a Session a previous launch held and released as resumable after a restart', async (context) => {
  const file = await ledgerPath(context)
  const before = ledgerAt(file, { pid: 10, registry: 'window-a' })
  before.bind('session-1')
  before.release('session-1')

  const after = ledgerAt(file, { pid: 20, registry: 'window-b' }, [20])

  assert.equal(after.standing('session-1'), 'resumable')
})

test('reads a Session whose owner was killed before it could release as resumable', async (context) => {
  const file = await ledgerPath(context)
  ledgerAt(file, { pid: 10, registry: 'window-a' }).bind('session-1')

  const after = ledgerAt(file, { pid: 20, registry: 'window-b' }, [20])

  assert.equal(after.standing('session-1'), 'resumable')
})

test('reads a Session another running Argo window still drives as held elsewhere', async (context) => {
  const file = await ledgerPath(context)
  ledgerAt(file, { pid: 10, registry: 'window-a' }).bind('session-1')

  const sameProcess = ledgerAt(file, { pid: 10, registry: 'window-b' }, [10])
  const otherProcess = ledgerAt(file, { pid: 20, registry: 'window-b' }, [10, 20])

  assert.equal(sameProcess.standing('session-1'), 'held-elsewhere')
  assert.equal(otherProcess.standing('session-1'), 'held-elsewhere')
})

test('keeps what other windows wrote when it writes its own claim', async (context) => {
  const file = await ledgerPath(context)
  const first = ledgerAt(file, { pid: 10, registry: 'window-a' })
  const second = ledgerAt(file, { pid: 10, registry: 'window-b' }, [10])
  first.bind('session-1')
  second.bind('session-2')

  const reread = ledgerAt(file, { pid: 30, registry: 'window-c' }, [10])

  assert.equal(reread.standing('session-1'), 'held-elsewhere')
  assert.equal(reread.standing('session-2'), 'held-elsewhere')
})

test('a window that let a Session go reads it as held elsewhere once another window resumes it', async (context) => {
  const file = await ledgerPath(context)
  const first = ledgerAt(file, { pid: 10, registry: 'window-a' }, [10])
  const second = ledgerAt(file, { pid: 10, registry: 'window-b' }, [10])
  first.bind('session-1')
  first.release('session-1')
  second.bind('session-1')

  first.bind('session-2')

  assert.equal(first.standing('session-1'), 'held-elsewhere')
  assert.equal(
    ledgerAt(file, { pid: 30, registry: 'window-c' }, [10]).standing('session-1'),
    'held-elsewhere',
  )
})

test('reads an unreadable ledger as no Sessions owned and rewrites it on the next claim', async (context) => {
  const file = await ledgerPath(context)
  await writeFile(file, '{ not json')
  const ledger = ledgerAt(file, { pid: 10, registry: 'window-a' })

  assert.equal(ledger.standing('session-1'), 'resumable')
  ledger.bind('session-1')
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    'session-1': { owner: { pid: 10, registry: 'window-a' } },
  })
})

test('stores no titles, order or content, only the owner of each Session', async (context) => {
  const file = await ledgerPath(context)
  const ledger = ledgerAt(file, { pid: 10, registry: 'window-a' })
  ledger.bind('session-1')
  ledger.bind('session-2')
  ledger.release('session-2')

  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
    'session-1': { owner: { pid: 10, registry: 'window-a' } },
    'session-2': { owner: null },
  })
})

test('reads a Session this window holds as held here', async (context) => {
  const ledger = ledgerAt(await ledgerPath(context), { pid: 10, registry: 'window-a' }, [10])
  ledger.bind('session-1')

  assert.equal(ledger.standing('session-1'), 'held-here')
  ledger.release('session-1')
  assert.equal(ledger.standing('session-1'), 'resumable')
})

test('a ledger that cannot be written still grades this launch correctly', async (context) => {
  const file = path.join(await ledgerPath(context), 'missing-folder', 'ledger.json')
  const ledger = ledgerAt(file, { pid: 10, registry: 'window-a' }, [10])

  assert.doesNotThrow(() => ledger.bind('session-1'))
  assert.equal(ledger.standing('session-1'), 'held-here')
})
