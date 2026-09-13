import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionListReplySchema } from '@/core/sessions/contract.ts'
import type { SessionRosterRow } from '@/core/sessions/models.ts'
import { createClaudeSessionReader } from '../sessions/read-sessions.ts'
import { claudeResumeTarget } from '../sessions/resume-target.ts'
import { fixtureRoot } from './session-fixtures'

const listing = { version: 1, type: 'session.list', requestId: 'list-1' }

async function rosterOf(reader: ReturnType<typeof createClaudeSessionReader>) {
  const reply = sessionListReplySchema.parse(await reader.listSessions(listing))
  assert.equal(reply.type, 'session.listed')
  return reply.type === 'session.listed' ? reply.sessions : []
}

test('resumes a chain from its latest link, in the folder that link worked in', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild'])

  assert.deepEqual(await claudeResumeTarget(root, 'resumeParent'), {
    cwd: '/Users/x/proj',
    tipId: 'resumeChild',
  })
})

test('finds nothing to resume for a Session with no transcript', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent'])

  assert.equal(await claudeResumeTarget(root, 'gone'), null)
  assert.equal(await claudeResumeTarget(`${root}/absent`, 'resumeParent'), null)
})

test('reads a Session Argo held before a restart as orphaned, and every other as external', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild', 'externalBasic'])
  const reader = createClaudeSessionReader({
    transcripts: root,
    orphans: () => new Set(['resumeParent']),
  })

  const roster = await rosterOf(reader)

  assert.deepEqual(roster.map(({ id, posture }) => [id, posture]).sort(), [
    ['externalBasic', 'external'],
    ['resumeParent', 'orphaned'],
  ])
})

test('reads a Session this window drives as managed, not orphaned', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild'])
  const [row] = await rosterOf(createClaudeSessionReader({ transcripts: root }))
  assert.ok(row)
  const driven: SessionRosterRow = { ...row, posture: 'managed' }
  const reader = createClaudeSessionReader({
    transcripts: root,
    orphans: () => new Set([row.id]),
    managedSessions: () => [driven],
  })

  const roster = await rosterOf(reader)

  assert.deepEqual(
    roster.map(({ posture }) => posture),
    ['managed'],
  )
})
