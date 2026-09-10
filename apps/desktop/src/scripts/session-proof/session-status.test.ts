import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stitchChains } from '../sessions/chains.ts'
import { projectRosterRow } from '../sessions/roster.ts'
import { fixtureFiles } from './session-fixtures'

async function rowOf(names) {
  return projectRosterRow(stitchChains(await fixtureFiles(names))[0])
}

test('reads a closed Turn as idle and a Turn inside the vocabulary as stopped', async () => {
  assert.equal((await rowOf(['externalBasic'])).status, 'idle')
  assert.equal((await rowOf(['haltedTurn'])).status, 'stopped')
})

// The degrade-down rule: a stop reason Argo's vocabulary has not heard of, and a history whose
// last record is not an assistant, both read `unknown` rather than the nearest guess.
test('reads a word outside the vocabulary as unknown, never as the nearest guess', async () => {
  assert.equal((await rowOf(['stopUnknown'])).status, 'unknown')
  assert.equal((await rowOf(['unparseableBody'])).status, 'unknown')
})

test('reads asking only where the pending question is still the last thing said', async () => {
  assert.equal((await rowOf(['askPending'])).status, 'asking')
  assert.equal((await rowOf(['askAnswered'])).status, 'idle')
  // The question was offered, then the Turn carried on past it. Nothing is waiting on a person.
  assert.equal((await rowOf(['askOffered'])).status, 'idle')
})

test('projects every row as external, because ownership is not observed here', async () => {
  const row = await rowOf(['externalBasic'])
  assert.equal(row.posture, 'external')
  assert.equal(row.cli, 'claude')
})

test('titles a Session by what a person typed over what the CLI summarised', async () => {
  assert.deepEqual((await rowOf(['titledHeadless'])).title, {
    text: 'The name a person typed',
    source: 'custom',
  })
  assert.deepEqual((await rowOf(['externalBasic'])).title, {
    text: 'Refactor the auth module',
    source: 'first-prompt',
  })
})

test('is headless only where every link is, and reads the newest place', async () => {
  assert.equal((await rowOf(['titledHeadless'])).entry, 'headless')
  const merged = await rowOf(['worktreeRelocated', 'worktreeOrigin'])
  assert.equal(merged.entry, 'interactive')
  assert.equal(merged.cwd, '/Users/x/proj/.claude/worktrees/argo+735')
  assert.equal(merged.branch, 'worktree-argo+735')
  assert.equal(merged.updatedAt, '2026-08-26T09:10:05.000Z')
})

test('counts the unreadable lines of every file in the Session', async () => {
  assert.equal((await rowOf(['externalBasic'])).unreadableLines, 1)
  assert.equal((await rowOf(['unparseableBody'])).unreadableLines, 5)
})

// A subagent finishing is not this Session finishing. The last record here is the subagent's
// `end_turn`; the Session's own last record left its Turn open on a tool call, so the reading is
// `unknown`. Reading the subagent's word instead would report work that is still running as done.
test('does not read a subagent stopping as the Session stopping', async () => {
  assert.equal((await rowOf(['subagentTail'])).status, 'unknown')
})
