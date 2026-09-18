import assert from 'node:assert/strict'
import { test } from 'node:test'
import { managedRow, mergeManagedRoster } from './managed-row'
import type { SessionRosterRow, SessionStatus } from './models'

const setup = { model: null, effort: null, mode: null } as const

function row(id: string, status: SessionStatus): SessionRosterRow {
  return managedRow(id, {
    cli: 'claude',
    compactionPercentage: null,
    compactionStartedAt: null,
    compactionTokens: null,
    cwd: '/projects/argo',
    status,
    setup,
    prompt: 'Do the thing.',
    startedAt: '2026-09-14T00:00:00.000Z',
  })
}

function mergedStatus(discoveredStatus: SessionStatus, heldStatus: SessionStatus) {
  const merged = mergeManagedRoster(
    {
      rows: [row('s1', discoveredStatus)],
      filesFound: 1,
      filesRead: 1,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
    },
    [row('s1', heldStatus)],
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
