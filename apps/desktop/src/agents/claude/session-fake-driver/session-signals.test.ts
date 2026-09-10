import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDelegation } from '../../../core/sessions/delegation.ts'
import { isSessionListReply } from '../../../core/sessions/replies.ts'
import { stitchChains } from '../sessions/chains.ts'
import { projectRosterRow } from '../sessions/roster.ts'
import { fixtureFiles } from './session-fixtures'

async function rowOf(names) {
  return projectRosterRow(stitchChains(await fixtureFiles(names))[0])
}

test('reads the Plan off the newest snapshot the agent could have written', async () => {
  // The second call in the same record has an entry with no status, so it is skipped whole and
  // the snapshot before it stands.
  assert.deepEqual((await rowOf(['plannedWork'])).plan, { total: 4, completed: 1, inProgress: 1 })
  assert.equal((await rowOf(['externalBasic'])).plan, null)
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
  assert.equal(isSessionListReply(reply([row])), true)
  const { plan: _plan, ...planless } = row
  assert.equal(isSessionListReply(reply([planless])), false)
  assert.equal(
    isSessionListReply(reply([{ ...row, plan: { total: -1, completed: 0, inProgress: 0 } }])),
    false,
  )
  assert.equal(isSessionListReply(reply([{ ...row, delegations: [{ id: 'x' }] }])), false)
  const { pullRequest: _pullRequest, ...unlinked } = row
  assert.equal(isSessionListReply(reply([unlinked])), false)
  assert.equal(isSessionListReply(reply([{ ...row, pullRequest: { number: 1312 } }])), false)
})
