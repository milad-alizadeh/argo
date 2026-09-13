import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionListReplySchema } from '../../../core/sessions/contract.ts'
import { readDelegation } from '../../../core/sessions/delegation.ts'
import { readPlan } from '../../../core/sessions/signals.ts'
import type { TranscriptMessage } from '../../../core/sessions/transcript.ts'
import { stitchChains } from '../sessions/chains.ts'
import { projectRosterRow } from '../sessions/roster.ts'
import { fixtureFiles } from './session-fixtures'

async function rowOf(names) {
  return projectRosterRow(stitchChains(await fixtureFiles(names))[0])
}

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

test('marks an unreadable latest Plan snapshot as malformed', () => {
  const malformedPlan: TranscriptMessage = {
    kind: 'message',
    uuid: 'malformed-plan',
    parentUuid: null,
    originSessionId: null,
    role: 'assistant',
    sidechain: false,
    cwd: null,
    branch: null,
    timestamp: null,
    entry: 'interactive',
    stopReason: null,
    blocks: [],
    toolCalls: [{ id: 'plan', name: 'TodoWrite', input: { todos: [{ content: 'No status' }] } }],
    answeredCalls: [],
    usage: null,
  }
  assert.deepEqual(readPlan([malformedPlan]), { state: 'malformed' })
})

test('starts the Turn at the last prompt, never at a tool result', async () => {
  assert.equal((await rowOf(['plannedWork'])).turnStartedAt, '2026-08-30T10:05:00.000Z')
  assert.equal((await rowOf(['subagentTail'])).turnStartedAt, '2026-08-14T11:00:01.000Z')
})

test('names the newest call of the open Turn by its tool and the thing it acted on', async () => {
  assert.deepEqual((await rowOf(['plannedWork'])).activity, {
    tool: 'Edit',
    target: 'SubagentDots.tsx',
  })
  assert.deepEqual((await rowOf(['subagentTail'])).activity, { tool: 'Task', target: null })
})

test('reads every delegation with its own label, and which of them came back', async () => {
  assert.deepEqual((await rowOf(['plannedWork'])).delegations, [
    { id: 'call-read', label: 'Read the rail', landed: true },
    { id: 'call-dots', label: null, landed: false },
  ])
  assert.deepEqual((await rowOf(['askOffered'])).delegations, [
    { id: 'call-verify', label: 'verify the fold', landed: true },
  ])
  assert.deepEqual((await rowOf(['externalBasic'])).delegations, [])
})

test('reads the shell commands running now, and none of the ones that came back', async () => {
  // The first `Bash` call has its result, so only the two with none are running. The command is
  // cut to its first line, which is what the rail has room to say.
  assert.deepEqual((await rowOf(['shellRunning'])).shell, [
    { id: 'sh-call-suite', command: 'bun run --cwd apps/desktop test', background: false },
    { id: 'sh-call-watch', command: 'npm run watch', background: true },
  ])
  assert.deepEqual((await rowOf(['externalBasic'])).shell, [])
})

const open = { id: 'open', label: null, landed: false }
const home = { id: 'home', label: 'verify', landed: true }

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
