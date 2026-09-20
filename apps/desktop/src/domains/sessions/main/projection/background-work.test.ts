import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionShellCommand, SessionSubagent } from '@/domains/sessions/contract/model/models'
import { rosterRow } from '@/domains/sessions/contract/observation/roster-row-test-fixture'
import { hasRunningBackgroundWork } from './background-work'

const agent: SessionSubagent = {
  id: 'agent',
  label: null,
  state: 'running',
  startedAt: null,
  endedAt: null,
}

function shell(state: SessionShellCommand['state']): SessionShellCommand {
  return {
    id: 'shell',
    command: 'bun test',
    label: null,
    background: state !== 'running',
    state,
    startedAt: null,
    endedAt: null,
    outputPath: null,
    result: null,
  }
}

const session = rosterRow({ status: 'running' })

test('finds running background work only on a managed Session', () => {
  assert.equal(hasRunningBackgroundWork(session), false)
  assert.equal(
    hasRunningBackgroundWork({
      ...session,
      subagents: [agent],
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
      subagents: [agent],
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

// A background Shell stays in the Shell list after it ends, so the list is no longer the answer.
test('reads a finished background Shell as no longer running', () => {
  assert.equal(hasRunningBackgroundWork({ ...session, shell: [shell('completed')] }), false)
  assert.equal(hasRunningBackgroundWork({ ...session, shell: [shell('failed')] }), false)
})
