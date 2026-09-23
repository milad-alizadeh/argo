import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionListReplySchema } from '@/domains/sessions/contract/ipc/contract.ts'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models.ts'
import type { SessionReader } from '@/domains/sessions/main/composition/bridge'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { claudeSessionSource } from '../sessions/discovery/read-sessions'
import { claudeResumeTarget } from '../sessions/discovery/resume-target'
import { fixtureRoot } from './session-fixtures'

const listing = { version: 1, type: 'session.list', requestId: 'list-1', projectRoot: null }

async function rosterOf(reader: SessionReader) {
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

test('reads a Session Argo held before a restart as external, same as every other', async (context) => {
  const root = await fixtureRoot(context, [
    'resumeParent',
    'resumeChild',
    '11111111-2222-4333-8444-555555555555',
  ])
  const reader = createSessionReader([claudeSessionSource({ transcripts: root })])

  const roster = await rosterOf(reader)

  assert.deepEqual(roster.map(({ id, posture }) => [id, posture]).sort(), [
    ['11111111-2222-4333-8444-555555555555', 'external'],
    ['resumeParent', 'external'],
  ])
})

test('reads a Session this window drives as managed, not external', async (context) => {
  const root = await fixtureRoot(context, ['resumeParent', 'resumeChild'])
  const [row] = await rosterOf(createSessionReader([claudeSessionSource({ transcripts: root })]))
  assert.ok(row)
  const driven: SessionRosterRow = { ...row, posture: 'managed' }
  const reader = createSessionReader([
    claudeSessionSource({
      transcripts: root,
      managedSessions: () => [driven],
    }),
  ])

  const roster = await rosterOf(reader)

  assert.deepEqual(
    roster.map(({ posture }) => posture),
    ['managed'],
  )
})
