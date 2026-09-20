import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fixtureRoot, unscopedListing } from '@/agents/claude/integration/session-fixtures'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions.ts'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { managedRow } from '@/domains/sessions/main/lifecycle/managed-row'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'

// A pid that existed and has exited, so no live process holds it.
const exitedPid = spawnSync('true').pid

const SESSION = 'thinkingCommandRuns'

async function listWithProcess(
  context: Parameters<typeof fixtureRoot>[0],
  written: { pid: number; status: 'busy' | 'idle' },
  managedSessions?: () => SessionRosterRow[],
) {
  const transcripts = await fixtureRoot(context, [SESSION])
  const processes = await mkdtemp(path.join(os.tmpdir(), 'argo-processes-'))
  context.after(() => rm(processes, { recursive: true, force: true }))
  await writeFile(
    path.join(processes, `${written.pid}.json`),
    JSON.stringify({ ...written, sessionId: SESSION, kind: 'interactive' }),
  )
  const reply = await createSessionReader([
    claudeSessionSource({
      transcripts,
      processes,
      managedSessions,
      // The ledger sees no other Argo window: any lock below comes from the live process alone.
      isLockedElsewhere: () => false,
    }),
  ]).listSessions(unscopedListing)
  assert.equal(reply.type, 'session.listed')
  return reply.sessions
}

// `thinkingCommandRuns` ends on a tool result: an open Turn the transcript alone reads `unknown`.
const cases = [
  { process: 'busy', pid: process.pid, expected: 'running' },
  { process: 'idle', pid: process.pid, expected: 'idle' },
  { process: 'busy', pid: exitedPid, expected: 'unknown' },
] as const

for (const { process: state, pid, expected } of cases) {
  const alive = pid === process.pid ? 'live' : 'exited'
  test(`reads an open Turn whose ${alive} process says ${state} as ${expected}`, async (context) => {
    const sessions = await listWithProcess(context, { pid, status: state })
    assert.deepEqual(
      sessions.map((session) => session.status),
      [expected],
    )
  })
}

// ADR-0040: a Session another process runs live is locked, at its prompt or mid-Turn alike.
for (const status of ['busy', 'idle'] as const) {
  test(`locks a Session a live \`claude\` in another terminal holds while ${status}`, async (context) => {
    const sessions = await listWithProcess(context, { pid: process.pid, status })
    assert.deepEqual(
      sessions.map(({ id, locked }) => ({ id, locked })),
      [{ id: SESSION, locked: true }],
    )
  })
}

test('keeps a Session resumable once the process that held it has exited', async (context) => {
  const sessions = await listWithProcess(context, { pid: exitedPid, status: 'idle' })
  assert.deepEqual(
    sessions.map(({ id, locked }) => ({ id, locked })),
    [{ id: SESSION, locked: false }],
  )
})

test('never locks a Session this Argo holds, although its own `claude` names it', async (context) => {
  const held = managedRow(SESSION, {
    cli: 'claude',
    cwd: '/Users/x/tree',
    status: 'running',
    setup: { model: null, effort: null, mode: null },
    prompt: 'Run the check.',
    startedAt: '2026-07-20T15:00:00.000Z',
  })
  const sessions = await listWithProcess(context, { pid: process.pid, status: 'busy' }, () => [
    held,
  ])
  assert.deepEqual(
    sessions.map(({ id, posture, locked }) => ({ id, posture, locked })),
    [{ id: SESSION, posture: 'managed', locked: false }],
  )
})
