import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasRunningBackgroundWork } from './background-work'
import type { SessionDelegation, SessionRosterRow, SessionShellCommand } from './models'

const agent: SessionDelegation = {
  id: 'agent',
  label: null,
  landed: false,
  startedAt: null,
  endedAt: null,
}

function shell(state: SessionShellCommand['state']): SessionShellCommand {
  return {
    id: 'shell',
    command: 'bun test',
    background: state !== 'running',
    state,
    startedAt: null,
    endedAt: null,
    outputPath: null,
    result: null,
  }
}

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
  setup: { model: null, effort: null, mode: null },
}

test('finds running background work only on a managed Session', () => {
  assert.equal(hasRunningBackgroundWork(session), false)
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      delegations: [agent],
    }),
    true,
  )
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      shell: [shell('running')],
    }),
    true,
  )
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      status: 'idle',
      delegations: [agent],
    }),
    false,
  )
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      posture: 'external',
      shell: [shell('running')],
    }),
    false,
  )
})

// A background Shell stays on the rail after it ends, so the list is no longer the answer.
test('reads a finished background Shell as no longer running', () => {
  assert.equal(hasRunningBackgroundWork({ ...session, shell: [shell('completed')] }), false)
  assert.equal(hasRunningBackgroundWork({ ...session, shell: [shell('failed')] }), false)
})
