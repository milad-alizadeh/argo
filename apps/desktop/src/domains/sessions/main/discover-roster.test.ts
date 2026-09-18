import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { discoverRoster } from './discover-roster'
import { managedRow } from './managed-row'

const PROJECT = '/projects/argo'

function row(id: string, cwd: string): SessionRosterRow {
  return managedRow(id, {
    cli: 'claude',
    compactionPercentage: null,
    compactionStartedAt: null,
    compactionTokens: null,
    handoffFailure: null,
    handoffStartedAt: null,
    cwd,
    status: 'idle',
    setup: { model: null, effort: null, mode: null },
    prompt: 'Do the thing.',
    startedAt: '2026-09-14T00:00:00.000Z',
  })
}

function intoProject(ids: string[]) {
  return (rows: SessionRosterRow[]) =>
    rows.map((session) => (ids.includes(session.id) ? { ...session, cwd: PROJECT } : session))
}

test('scopes the roster to the Project after every join and the managed merge', async () => {
  const roster = await discoverRoster({
    discovery: {
      rows: [
        { ...row('observed', '/elsewhere'), posture: 'external' },
        { ...row('outside', '/elsewhere'), posture: 'external' },
      ],
      filesFound: 2,
      filesRead: 2,
      filesUnreadable: 0,
      filesParsed: 0,
      nextCursor: null,
      historyComplete: true,
    },
    managed: [row('held', '/elsewhere')],
    joins: { observed: [intoProject(['observed'])], merged: [intoProject(['held'])] },
    projectRoot: PROJECT,
  })

  assert.deepEqual(
    roster.rows.map((session) => session.id),
    ['observed', 'held'],
  )
})
