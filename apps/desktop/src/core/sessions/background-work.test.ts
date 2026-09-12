import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRunningBackgroundWork } from './background-work'
import type { SessionRosterRow } from './models'

const session: SessionRosterRow = {
  id: 'session',
  retiredIds: [],
  cli: 'claude',
  posture: 'managed',
  title: null,
  status: 'running',
  entry: 'interactive',
  cwd: null,
  branch: null,
  updatedAt: null,
  unreadableLines: 0,
  originUnread: false,
  turnStartedAt: null,
  activity: null,
  plan: null,
  delegations: [],
  shell: [],
  pullRequest: null,
  archived: false,
}

test('finds running background work only on a managed Session', () => {
  assert.equal(hasRunningBackgroundWork(session), false)
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      delegations: [{ id: 'agent', label: null, landed: false }],
    }),
    true,
  )
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      shell: [{ id: 'shell', command: 'bun test', background: false }],
    }),
    true,
  )
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      status: 'idle',
      delegations: [{ id: 'agent', label: null, landed: false }],
    }),
    false,
  )
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      posture: 'external',
      shell: [{ id: 'shell', command: 'bun test', background: false }],
    }),
    false,
  )
})
