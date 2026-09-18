import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionListReplySchema } from '../../../domains/sessions/contract/contract.ts'
import { readDelegation } from '../../../domains/sessions/main/delegation.ts'
import { fixtureRosterRow as rowOf } from './session-fixtures'

test('reads the Plan entries off the newest snapshot the agent wrote', async () => {
  assert.deepEqual((await rowOf(['plannedWork'])).plan, {
    state: 'available',
    entries: [
      { content: 'Read the rail', position: 0, status: 'completed' },
      { content: 'Draw the dots', position: 1, status: 'in_progress' },
      { content: 'Count the running', position: 2, status: 'pending' },
      { content: 'Check the ceiling', position: 3, status: 'pending' },
    ],
  })
  assert.equal((await rowOf(['externalBasic'])).plan, null)
})

test('starts the Turn at the last prompt, never at a tool result', async () => {
  assert.equal((await rowOf(['plannedWork'])).turnStartedAt, '2026-08-30T10:05:00.000Z')
  assert.equal((await rowOf(['subagentTail'])).turnStartedAt, '2026-08-14T11:00:01.000Z')
})

test('names the newest call of the open Turn with its canonical label and metadata', async () => {
  assert.deepEqual((await rowOf(['plannedWork'])).activity, {
    label: 'Edited SubagentDots.tsx',
    kind: 'edited',
    open: true,
    tool: 'Edit',
    target: 'SubagentDots.tsx',
  })
})

// A spawned Subagent is a delegation, never a Tool Call, so it reads as no activity of its own.
test('reads an open Subagent as a running delegation, not as an open call', async () => {
  const row = await rowOf(['subagentTail'])
  assert.equal(row.activity, null)
  assert.deepEqual(row.delegations, [
    {
      id: 'call-task-1',
      label: null,
      landed: false,
      startedAt: '2026-08-14T11:00:20.000Z',
      endedAt: null,
    },
  ])
})

test('reads every delegation with its own label, and which of them came back', async () => {
  assert.deepEqual((await rowOf(['plannedWork'])).delegations, [
    {
      id: 'call-read',
      label: 'Read the rail',
      landed: true,
      startedAt: '2026-08-30T10:00:10.000Z',
      endedAt: '2026-08-30T10:01:00.000Z',
    },
    {
      id: 'call-dots',
      label: null,
      landed: false,
      startedAt: '2026-08-30T10:05:10.000Z',
      endedAt: null,
    },
  ])
  assert.deepEqual((await rowOf(['askOffered'])).delegations, [
    {
      id: 'call-verify',
      label: 'verify the fold',
      landed: true,
      startedAt: '2026-08-01T09:00:43.000Z',
      endedAt: '2026-08-01T09:02:00.000Z',
    },
  ])
  assert.deepEqual((await rowOf(['externalBasic'])).delegations, [])
})

const open = { id: 'open', label: null, landed: false, startedAt: null, endedAt: null }
const home = { id: 'home', label: 'verify', landed: true, startedAt: null, endedAt: null }

test('counts an open delegation as running only while its Session is live', () => {
  assert.deepEqual(readDelegation('asking', [open, home]), {
    known: true,
    running: [open],
    finished: 1,
    unresolved: 0,
  })
  // A settled Session has nothing running under it, so what never came back is unresolved.
  assert.deepEqual(readDelegation('idle', [open, home]), {
    known: true,
    running: [],
    finished: 1,
    unresolved: 1,
  })
})

test('reads the newest pull request the CLI linked, and none where it linked nothing', async () => {
  assert.deepEqual((await rowOf(['marks'])).pullRequest, {
    number: 1312,
    url: 'https://github.com/x/marks/pull/1312',
    repository: null,
  })
  assert.equal((await rowOf(['externalBasic'])).pullRequest, null)
})

test('reads no delegation at all for a Session whose own state is unknown', () => {
  assert.deepEqual(readDelegation('unknown', [open, home]), { known: false })
})

test('refuses a row whose signals are missing or malformed at the boundary', async () => {
  const row = await rowOf(['plannedWork'])
  const reply = (sessions) => ({
    version: 1,
    type: 'session.listed',
    requestId: 'r1',
    sessions,
    filesFound: 1,
    filesRead: 1,
    filesUnreadable: 0,
    filesParsed: 0,
    nextCursor: null,
    historyComplete: true,
  })
  assert.equal(sessionListReplySchema.safeParse(reply([row])).success, true)
  const { plan: _plan, ...planless } = row
  assert.equal(sessionListReplySchema.safeParse(reply([planless])).success, false)
  assert.equal(
    sessionListReplySchema.safeParse(
      reply([
        {
          ...row,
          plan: {
            state: 'available',
            entries: [{ content: '', position: 0, status: 'completed' }],
          },
        },
      ]),
    ).success,
    false,
  )
  assert.equal(
    sessionListReplySchema.safeParse(reply([{ ...row, delegations: [{ id: 'x' }] }])).success,
    false,
  )
  const { pullRequest: _pullRequest, ...unlinked } = row
  assert.equal(sessionListReplySchema.safeParse(reply([unlinked])).success, false)
  assert.equal(
    sessionListReplySchema.safeParse(reply([{ ...row, pullRequest: { number: 1312 } }])).success,
    false,
  )
})
