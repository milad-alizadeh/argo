import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import { beginWatchedResume } from './resume-watched'

const projection = { session: { harness: 'codex', nativeId: 'thread-1' } } as SessionProjection

test('a refused vendor check does not open a managed channel', async () => {
  const events: string[] = []
  const outcome = await beginWatchedResume({
    readPermission: async () => {
      events.push('permission')
      return { resumable: false, reason: 'Another Codex client holds this Session.' }
    },
    openManaged: async () => {
      events.push('open')
      return { kind: 'accepted', projection }
    },
  })
  assert.deepEqual(outcome, {
    kind: 'rejected',
    reason: 'Another Codex client holds this Session.',
  })
  assert.deepEqual(events, ['permission'])
})

test('native resume follows a successful vendor liveness check', async () => {
  const events: string[] = []
  const outcome = await beginWatchedResume({
    readPermission: async () => {
      events.push('permission')
      return { resumable: true }
    },
    openManaged: async () => {
      events.push('open')
      return { kind: 'accepted', projection }
    },
  })
  assert.equal(outcome.kind, 'accepted')
  assert.deepEqual(events, ['permission', 'open'])
})

test('failed native resume keeps the vendor reason', async () => {
  const outcome = await beginWatchedResume({
    readPermission: async () => ({ resumable: true }),
    openManaged: async () => {
      throw new Error('rollout is locked by Codex Desktop')
    },
  })
  assert.deepEqual(outcome, { kind: 'rejected', reason: 'rollout is locked by Codex Desktop' })
})
