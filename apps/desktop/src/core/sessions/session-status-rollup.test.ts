import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionPosture, SessionStatus } from './models'
import { rollupSessionStatus } from './session-status-rollup'

test('a non-managed posture always reads the floor, whatever the signal claims', () => {
  const postures: SessionPosture[] = ['external', 'orphaned']
  for (const posture of postures) {
    assert.equal(
      rollupSessionStatus('idle', posture, { kind: 'claude', pendingPermission: true }),
      'idle',
    )
    assert.equal(
      rollupSessionStatus('unknown', posture, { kind: 'already', status: 'permission' }),
      'unknown',
    )
  }
})

test('a managed Session with no signal reads the floor', () => {
  assert.equal(rollupSessionStatus('idle', 'managed', null), 'idle')
})

test('Claude: a pending permission is DIRECT and wins over any floor', () => {
  const floors: SessionStatus[] = ['idle', 'asking', 'stopped', 'unknown', 'running']
  for (const floor of floors) {
    assert.equal(
      rollupSessionStatus(floor, 'managed', { kind: 'claude', pendingPermission: true }),
      'permission',
    )
  }
})

test('Claude: running only wins where the floor has nothing to say', () => {
  const signal = { kind: 'claude' as const, pendingPermission: false }
  assert.equal(rollupSessionStatus('unknown', 'managed', signal), 'running')
  assert.equal(rollupSessionStatus('idle', 'managed', signal), 'idle')
  assert.equal(rollupSessionStatus('asking', 'managed', signal), 'asking')
  assert.equal(rollupSessionStatus('stopped', 'managed', signal), 'stopped')
})

test('Codex: a thread reading only wins where the floor has nothing to say', () => {
  const signal = {
    kind: 'codex' as const,
    reading: { kind: 'thread' as const, status: 'idle' as const },
  }
  assert.equal(rollupSessionStatus('unknown', 'managed', signal), 'idle')
  assert.equal(rollupSessionStatus('asking', 'managed', signal), 'asking')
})

test('Codex: a permission reading is DIRECT and wins over any floor', () => {
  const signal = {
    kind: 'codex' as const,
    reading: { kind: 'thread' as const, status: 'permission' as const },
  }
  assert.equal(rollupSessionStatus('idle', 'managed', signal), 'permission')
})

test('Codex: a failed Turn is a degrade-down case, not a one-off exception, so it reads unknown', () => {
  const signal = { kind: 'codex' as const, reading: { kind: 'turn-failed' as const } }
  assert.equal(rollupSessionStatus('idle', 'managed', signal), 'idle')
  assert.equal(rollupSessionStatus('unknown', 'managed', signal), 'unknown')
})

test('managed-row tie-break: an already-derived managed status is used as the signal directly', () => {
  assert.equal(
    rollupSessionStatus('unknown', 'managed', { kind: 'already', status: 'running' }),
    'running',
  )
  assert.equal(
    rollupSessionStatus('idle', 'managed', { kind: 'already', status: 'permission' }),
    'permission',
  )
  // A definite floor (`idle`, `asking`, `stopped`) is never overridden by a managed `running`
  // just because it is held.
  assert.equal(
    rollupSessionStatus('idle', 'managed', { kind: 'already', status: 'running' }),
    'idle',
  )
  assert.equal(
    rollupSessionStatus('asking', 'managed', { kind: 'already', status: 'running' }),
    'asking',
  )
  assert.equal(
    rollupSessionStatus('stopped', 'managed', { kind: 'already', status: 'running' }),
    'stopped',
  )
})
