import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codexManagedStatus } from '@/agents/codex/drive/managed-status'

test('Codex: a waitingOnApproval thread flag reads permission', () => {
  assert.equal(
    codexManagedStatus({
      kind: 'thread',
      status: { type: 'active', activeFlags: ['waitingOnApproval'] },
    }),
    'permission',
  )
})

test('Codex: a waitingOnUserInput thread flag reads asking', () => {
  assert.equal(
    codexManagedStatus({
      kind: 'thread',
      status: { type: 'active', activeFlags: ['waitingOnUserInput'] },
    }),
    'asking',
  )
})

test('Codex: an active thread carrying no flag Argo knows reads running', () => {
  assert.equal(
    codexManagedStatus({ kind: 'thread', status: { type: 'active', activeFlags: [] } }),
    'running',
  )
})

test('Codex: an idle thread reads idle', () => {
  assert.equal(codexManagedStatus({ kind: 'thread', status: { type: 'idle' } }), 'idle')
})

test('Codex: systemError and notLoaded degrade down to unknown, never a guessed status', () => {
  for (const type of ['systemError', 'notLoaded'] as const) {
    assert.equal(codexManagedStatus({ kind: 'thread', status: { type } }), 'unknown')
  }
})

test('Codex: a failed Turn degrades down to unknown', () => {
  assert.equal(codexManagedStatus({ kind: 'turn-failed' }), 'unknown')
})
