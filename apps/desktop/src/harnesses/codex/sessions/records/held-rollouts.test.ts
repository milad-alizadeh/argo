import assert from 'node:assert/strict'
import { appendFile } from 'node:fs/promises'
import { test } from 'node:test'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { managedRow } from '@/domains/sessions/main/lifecycle/status/managed-row'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { codexSessionSource } from '../read-sessions'
import {
  OPEN_TURN_COMPLETE,
  openTurnRolloutRoot,
  rolloutPath,
  rosterRows as rows,
  OPEN_TURN_THREAD as THREAD,
} from '../rollout-test-helpers'
import { createHeldRolloutReader, heldRolloutIds } from './held-rollouts'

const OTHER_THREAD = '01a0b000-0000-7000-8000-000000000009'

// `lsof -F n -c codex`, as macOS 26 prints it: one process line, then one name line per file.
function listing(...rollouts: string[]) {
  return [
    'p5771',
    'n/dev/null',
    'n/Users/reader/.codex/state_5.sqlite',
    ...rollouts.map((rollout) => `n${rollout}`),
    '',
  ].join('\n')
}

// A rollout whose Turn ended, so any lock below comes from the file being held open alone.
async function settledRolloutRoot(context: { after: (cleanup: () => Promise<void>) => void }) {
  const { root, rollout } = await openTurnRolloutRoot(context)
  await appendFile(
    rollout,
    `${JSON.stringify({ timestamp: '2026-09-15T21:56:20.000Z', type: 'event_msg', payload: OPEN_TURN_COMPLETE })}\n`,
  )
  return { root, rollout }
}

function readerFor(
  root: string,
  listOpenFiles: () => Promise<string>,
  {
    roster,
    isLockedElsewhere = () => false,
  }: {
    roster?: () => SessionRosterRow[]
    isLockedElsewhere?: (sessionId: string) => boolean
  } = {},
) {
  return createSessionReader([
    codexSessionSource(root, { roster, isLockedElsewhere, listOpenFiles }),
  ])
}

function managedThread() {
  return managedRow(THREAD, {
    harness: 'codex',
    cwd: '/projects/argo',
    status: 'idle',
    setup: { model: null, effort: null, mode: null },
    prompt: 'Run the Codex check',
    startedAt: '2026-09-15T21:55:19.000Z',
  })
}

test('reads the thread id off every rollout a Codex process holds open', () => {
  const held = heldRolloutIds(
    listing(
      `/Users/reader/.codex/sessions/2026/09/15/rollout-2026-09-15T22-55-19-${THREAD}.jsonl`,
      `/Users/reader/.codex/sessions/2026/09/16/rollout-2026-09-16T08-00-00-${OTHER_THREAD}.jsonl`,
    ),
  )
  assert.deepEqual([...held].sort(), [THREAD, OTHER_THREAD])
})

test('locks an idle thread that another Codex client has open', async (context) => {
  const { root, rollout } = await settledRolloutRoot(context)
  assert.deepEqual(await rows(readerFor(root, async () => listing(rollout))), [
    { id: THREAD, posture: 'external', status: 'idle', locked: true },
  ])
})

test('leaves a thread resumable when no Codex process holds its rollout', async (context) => {
  const { root } = await settledRolloutRoot(context)
  const reader = readerFor(root, async () => listing(rolloutPath(root, OTHER_THREAD)))
  assert.deepEqual(await rows(reader), [
    { id: THREAD, posture: 'external', status: 'idle', locked: false },
  ])
})

test('leaves every thread resumable when the open file table cannot be read', async (context) => {
  const { root } = await settledRolloutRoot(context)
  const reader = readerFor(root, async () => {
    throw new Error('spawn lsof ENOENT')
  })
  assert.deepEqual(await rows(reader), [
    { id: THREAD, posture: 'external', status: 'idle', locked: false },
  ])
})

test('never locks a thread this Argo holds, whose own app-server is the process holding it', async (context) => {
  const { root, rollout } = await settledRolloutRoot(context)
  const held = managedThread()
  assert.deepEqual(
    await rows(readerFor(root, async () => listing(rollout), { roster: () => [held] })),
    [{ id: THREAD, posture: 'managed', status: 'idle', locked: false }],
  )
})

test('never re-locks a thread this Argo manages when the ownership ledger is stale', async (context) => {
  const { root } = await settledRolloutRoot(context)
  const held = managedThread()

  assert.deepEqual(
    await rows(
      readerFor(root, async () => listing(), {
        roster: () => [held],
        isLockedElsewhere: () => true,
      }),
    ),
    [{ id: THREAD, posture: 'managed', status: 'idle', locked: false }],
  )
})

test('serves one listing for five seconds, then refreshes behind the read that finds it stale', async () => {
  const listings = [listing('/x/rollout-a-01a0b000-0000-7000-8000-000000000001.jsonl'), listing()]
  let taken = 0
  const read = createHeldRolloutReader(async () => listings[taken++] ?? listing())
  assert.deepEqual([...(await read(0))], [THREAD])
  assert.deepEqual([...(await read(4999))], [THREAD])
  assert.equal(taken, 1)
  // The stale read still answers from the first listing while the second is being taken.
  assert.deepEqual([...(await read(5000))], [THREAD])
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual([...(await read(5001))], [])
  assert.equal(taken, 2)
})
