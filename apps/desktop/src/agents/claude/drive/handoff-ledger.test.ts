import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { createHandoffLedger } from '@/agents/claude/drive/handoff-ledger'

async function ledgerPath(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-handoff-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return { root, file: path.join(root, 'claude-session-handoffs.json') }
}

test('a Session with no recorded handoff has no edges', async (context) => {
  const { file } = await ledgerPath(context)
  const ledger = createHandoffLedger({ path: file })
  assert.deepEqual(ledger.edgesFor('s1'), { to: null, from: null })
})

test('recording a handoff names the destination on the source and the source on the destination', async (context) => {
  const { file } = await ledgerPath(context)
  const ledger = createHandoffLedger({ path: file })
  ledger.record('s1', 's2')
  assert.deepEqual(ledger.edgesFor('s1'), { to: 's2', from: null })
  assert.deepEqual(ledger.edgesFor('s2'), { to: null, from: 's1' })
})

test('a second ledger instance reads an edge the first one wrote', async (context) => {
  const { file } = await ledgerPath(context)
  createHandoffLedger({ path: file }).record('s1', 's2')
  const reader = createHandoffLedger({ path: file })
  assert.deepEqual(reader.edgesFor('s2'), { to: null, from: 's1' })
})

test('a save replaces the file and leaves no half-written one behind', async (context) => {
  const { file } = await ledgerPath(context)
  const ledger = createHandoffLedger({ path: file })
  ledger.record('s1', 's2')
  assert.deepEqual(await readdir(path.dirname(file)), [path.basename(file)])
})
