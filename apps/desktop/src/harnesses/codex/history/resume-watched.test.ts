import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import { beginWatchedResume, LEASE_REFUSAL } from './resume-watched'

const projection = { session: { harness: 'codex', nativeId: 'thread-1' } } as SessionProjection

function allowedPermission(events: string[]) {
  return async () => {
    events.push('permission')
    return { resumable: true } as const
  }
}

function refusedPermission(events: string[]) {
  return async () => {
    events.push('permission')
    return { resumable: false as const, reason: 'Another Codex client holds this Session.' }
  }
}

function managedLease(events: string[]) {
  return () => {
    events.push('lease')
    return { posture: 'managed' as const }
  }
}

function managedOpen(events: string[]) {
  return async () => {
    events.push('open')
    return { kind: 'accepted' as const, projection }
  }
}

test('a refused vendor check does not acquire a lease or open a managed channel', async () => {
  const events: string[] = []
  const outcome = await beginWatchedResume({
    readPermission: refusedPermission(events),
    acquireLease: managedLease(events),
    releaseLease: () => events.push('release'),
    openManaged: managedOpen(events),
  })
  assert.deepEqual(outcome, {
    kind: 'rejected',
    reason: 'Another Codex client holds this Session.',
  })
  assert.deepEqual(events, ['permission'])
})

test('a refused lease does not open a managed channel', async () => {
  const events: string[] = []
  const outcome = await beginWatchedResume({
    readPermission: async () => ({ resumable: true }),
    acquireLease: () => {
      events.push('lease')
      return { posture: 'watched' }
    },
    releaseLease: () => events.push('release'),
    openManaged: async () => {
      events.push('open')
      return { kind: 'accepted', projection }
    },
  })
  assert.equal(outcome.kind, 'rejected')
  if (outcome.kind === 'rejected') assert.equal(outcome.reason, LEASE_REFUSAL)
  assert.deepEqual(events, ['lease'])
})

test('resume opens a managed channel only after both checks', async () => {
  const events: string[] = []
  const outcome = await beginWatchedResume({
    readPermission: allowedPermission(events),
    acquireLease: managedLease(events),
    releaseLease: () => events.push('release'),
    openManaged: managedOpen(events),
  })
  assert.equal(outcome.kind, 'accepted')
  assert.deepEqual(events, ['permission', 'lease', 'open'])
})

test('a failed managed open releases the lease and keeps the vendor reason', async () => {
  let released = false
  const outcome = await beginWatchedResume({
    readPermission: async () => ({ resumable: true }),
    acquireLease: () => ({ posture: 'managed' }),
    releaseLease: () => {
      released = true
    },
    openManaged: async () => {
      throw new Error('rollout is locked by Codex Desktop')
    },
  })
  assert.equal(released, true)
  assert.deepEqual(outcome, { kind: 'rejected', reason: 'rollout is locked by Codex Desktop' })
})
