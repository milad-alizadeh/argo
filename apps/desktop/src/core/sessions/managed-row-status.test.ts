import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockManagedRow } from '../../../mocks/sessions/mock-managed-row'
import { mergeManagedRoster } from './managed-row'
import type { SessionStatus } from './models'

function mergedStatus(discoveredStatus: SessionStatus, heldStatus: SessionStatus) {
  const merged = mergeManagedRoster(
    {
      rows: [mockManagedRow('s1', discoveredStatus)],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
    },
    [mockManagedRow('s1', heldStatus)],
  )
  return merged.rows[0]?.status
}

test('the held permission status always wins over the discovered floor', () => {
  assert.equal(mergedStatus('idle', 'permission'), 'permission')
  assert.equal(mergedStatus('unknown', 'permission'), 'permission')
})

test('the held status wins only where the discovered floor has nothing to say', () => {
  assert.equal(mergedStatus('unknown', 'running'), 'running')
})

test('a definite discovered floor is never overridden by a held `running`', () => {
  assert.equal(mergedStatus('idle', 'running'), 'idle')
  assert.equal(mergedStatus('asking', 'running'), 'asking')
  assert.equal(mergedStatus('stopped', 'running'), 'stopped')
})
