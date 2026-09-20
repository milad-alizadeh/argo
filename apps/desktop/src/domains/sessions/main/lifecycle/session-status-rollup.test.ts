import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionPosture, SessionStatus } from '@/domains/sessions/contract/model/models'
import { rollupSessionStatus } from '@/domains/sessions/main/lifecycle/session-status-rollup'

test('a non-managed posture always reads the floor, whatever the reading claims', () => {
  const postures: SessionPosture[] = ['external']
  for (const posture of postures) {
    assert.equal(rollupSessionStatus('idle', posture, 'permission'), 'idle')
    assert.equal(rollupSessionStatus('unknown', posture, 'permission'), 'unknown')
  }
})

test('a managed Session with no reading reads the floor', () => {
  assert.equal(rollupSessionStatus('idle', 'managed', null), 'idle')
})

test('a managed permission is DIRECT and wins over any floor', () => {
  const floors: SessionStatus[] = ['idle', 'asking', 'stopped', 'unknown', 'running']
  for (const floor of floors) {
    assert.equal(rollupSessionStatus(floor, 'managed', 'permission'), 'permission')
  }
})

test('any other managed reading only wins where the floor has nothing to say', () => {
  const readings: SessionStatus[] = ['running', 'asking', 'idle', 'unknown']
  for (const reading of readings) {
    assert.equal(rollupSessionStatus('unknown', 'managed', reading), reading)
    // A definite floor is never overridden by a managed reading just because it is held.
    assert.equal(rollupSessionStatus('idle', 'managed', reading), 'idle')
    assert.equal(rollupSessionStatus('asking', 'managed', reading), 'asking')
    assert.equal(rollupSessionStatus('stopped', 'managed', reading), 'stopped')
  }
})
