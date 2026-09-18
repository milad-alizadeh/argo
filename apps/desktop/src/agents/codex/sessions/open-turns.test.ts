import assert from 'node:assert/strict'
import { appendFile, copyFile, mkdir, mkdtemp, rm, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { managedRow } from '@/domains/sessions/main/managed-row'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { listed } from '@/domains/sessions/main/reader-test-helpers'
import { codexSessionSource } from './read-sessions'

const THREAD = '01a0b000-0000-7000-8000-000000000001'
const DELEGATION = '01a0b000-0000-7000-8000-000000000002'
const FIXTURE = fileURLToPath(
  new URL(
    '../../../../mocks/cli/codex/fixtures/sessions/rollout-codexOpenTurn.jsonl',
    import.meta.url,
  ),
)

// The two ways codex-cli 0.147.0 closes a Turn, in the shape its rollouts write them.
const TURN_ENDS = {
  task_complete: {
    type: 'task_complete',
    turn_id: '01a0b000-0000-7000-8000-00000000a001',
    last_agent_message: 'Checked.',
    started_at: 1789509320,
    completed_at: 1789509380,
    duration_ms: 60000,
  },
  turn_aborted: {
    type: 'turn_aborted',
    turn_id: '01a0b000-0000-7000-8000-00000000a001',
    reason: 'interrupted',
    started_at: 1789509320,
    completed_at: 1789509322,
    duration_ms: 2154,
  },
}

function delegationActivity(kind: 'started' | 'completed') {
  return {
    type: 'event_msg',
    payload: {
      type: 'item_completed',
      item: {
        type: 'SubAgentActivity',
        id: `delegation-${kind}`,
        kind,
        agent_thread_id: DELEGATION,
        agent_path: '/root/inspect_session',
      },
    },
  }
}

async function completeTurnWithActiveDelegation(rollout: string) {
  await appendFile(
    rollout,
    `${JSON.stringify({ timestamp: '2026-09-15T21:56:20.000Z', ...delegationActivity('started') })}\n`,
  )
  await appendFile(
    rollout,
    `${JSON.stringify({ timestamp: '2026-09-15T21:56:21.000Z', type: 'event_msg', payload: TURN_ENDS.task_complete })}\n`,
  )
}

async function rolloutRoot(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-turns-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  const rollout = path.join(day, `rollout-2026-09-15T22-55-19-${THREAD}.jsonl`)
  await copyFile(FIXTURE, rollout)
  return { root, rollout }
}

function readerFor(root: string, roster?: () => SessionRosterRow[]) {
  // The ledger sees no other Argo window: any lock below comes from the rollout alone.
  return createSessionReader([codexSessionSource(root, { roster, isLockedElsewhere: () => false })])
}

async function rows(reader: ReturnType<typeof readerFor>) {
  const reply = await listed(reader)
  return reply?.sessions.map(({ id, posture, status, locked }) => ({ id, posture, status, locked }))
}

test('locks a thread whose newest Turn another Codex client is still running', async (context) => {
  const { root } = await rolloutRoot(context)
  assert.deepEqual(await rows(readerFor(root)), [
    { id: THREAD, posture: 'external', status: 'running', locked: true },
  ])
})

for (const [name, end] of Object.entries(TURN_ENDS)) {
  test(`unlocks the thread once its Turn ends with \`${name}\``, async (context) => {
    const { root, rollout } = await rolloutRoot(context)
    const reader = readerFor(root)
    await rows(reader)
    await appendFile(
      rollout,
      `${JSON.stringify({ timestamp: '2026-09-15T21:56:20.000Z', type: 'event_msg', payload: end })}\n`,
    )
    assert.deepEqual(await rows(reader), [
      { id: THREAD, posture: 'external', status: 'idle', locked: false },
    ])
  })
}

test('keeps a thread resumable when its open Turn has not been written to for 31 minutes', async (context) => {
  const { root, rollout } = await rolloutRoot(context)
  const silentSince = new Date(Date.now() - 31 * 60 * 1000)
  await utimes(rollout, silentSince, silentSince)
  assert.deepEqual(await rows(readerFor(root)), [
    { id: THREAD, posture: 'external', status: 'unknown', locked: false },
  ])
})

test('locks a completed root Turn while its Codex delegation is active', async (context) => {
  const { root, rollout } = await rolloutRoot(context)
  await completeTurnWithActiveDelegation(rollout)
  assert.deepEqual(await rows(readerFor(root)), [
    { id: THREAD, posture: 'external', status: 'running', locked: true },
  ])
})

test('unlocks a completed root Turn after its Codex delegation completes', async (context) => {
  const { root, rollout } = await rolloutRoot(context)
  await completeTurnWithActiveDelegation(rollout)
  await appendFile(
    rollout,
    `${JSON.stringify({ timestamp: '2026-09-15T21:56:22.000Z', ...delegationActivity('completed') })}\n`,
  )
  assert.deepEqual(await rows(readerFor(root)), [
    { id: THREAD, posture: 'external', status: 'idle', locked: false },
  ])
})

test('never locks a thread this Argo is running the Turn in', async (context) => {
  const { root } = await rolloutRoot(context)
  const held = managedRow(THREAD, {
    cli: 'codex',
    cwd: '/projects/argo',
    status: 'running',
    setup: { model: null, effort: null, mode: null },
    prompt: 'Run the Codex check',
    startedAt: '2026-09-15T21:55:19.000Z',
  })
  assert.deepEqual(await rows(readerFor(root, () => [held])), [
    { id: THREAD, posture: 'managed', status: 'running', locked: false },
  ])
})
