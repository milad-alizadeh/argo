import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createClaudeSessionReader } from '../sessions/read-sessions.ts'
import { fixtureRoot, unscopedListing } from './session-fixtures'

// A pid that existed and has exited, so no live process holds it.
const exitedPid = spawnSync('true').pid

// `thinkingCommandRuns` ends on a tool result: an open Turn the transcript alone reads `unknown`.
const cases = [
  { process: 'busy', pid: process.pid, expected: 'running' },
  { process: 'idle', pid: process.pid, expected: 'idle' },
  { process: 'busy', pid: exitedPid, expected: 'unknown' },
] as const

for (const { process: state, pid, expected } of cases) {
  const alive = pid === process.pid ? 'live' : 'exited'
  test(`reads an open Turn whose ${alive} process says ${state} as ${expected}`, async (context) => {
    const transcripts = await fixtureRoot(context, ['thinkingCommandRuns'])
    const processes = await mkdtemp(path.join(os.tmpdir(), 'argo-processes-'))
    context.after(() => rm(processes, { recursive: true, force: true }))
    await writeFile(
      path.join(processes, `${pid}.json`),
      JSON.stringify({ pid, sessionId: 'thinkingCommandRuns', status: state, kind: 'interactive' }),
    )
    const reply = await createClaudeSessionReader({ transcripts, processes }).listSessions(
      unscopedListing,
    )
    assert.equal(reply.type, 'session.listed')
    assert.deepEqual(
      reply.sessions.map((session) => session.status),
      [expected],
    )
  })
}
