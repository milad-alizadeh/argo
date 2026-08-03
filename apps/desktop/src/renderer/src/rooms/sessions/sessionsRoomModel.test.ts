import { type SessionFactsInput, type SessionView, sessionFacts, sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { buildSessionsRoomModel } from './sessionsRoomModel'

// The rail's contract as arithmetic (`cockpit-spec.md` §4.1): what order the rows come in, which
// sessions have already left for Archived, and what each row spells. None of it needs a browser.

const HEAD = 'a1b2c3d'

const idsOf = (sessions: readonly SessionView[]): string[] =>
  buildSessionsRoomModel({ sessions }).rows.map((row) => row.id)

const rowOf = (one: SessionView) => {
  const [row] = buildSessionsRoomModel({ sessions: [one] }).rows
  if (row === undefined) throw new Error(`${one.id} left the live rail`)
  return row
}

describe('the rail order', () => {
  it('lists the most recently active session first', () => {
    const sessions = [
      sessionView({ id: 'stale', lastActivityAt: 1_000 }),
      sessionView({ id: 'fresh', lastActivityAt: 3_000 }),
      sessionView({ id: 'middling', lastActivityAt: 2_000 }),
    ]
    expect(idsOf(sessions)).toEqual(['fresh', 'middling', 'stale'])
  })

  it('keeps the incoming order between sessions last active at the same moment', () => {
    const at = (id: string) => sessionView({ id, lastActivityAt: 5_000 })
    expect(idsOf([at('first'), at('second'), at('third')])).toEqual(['first', 'second', 'third'])
  })

  it('sorts a session whose activity was never observed last', () => {
    const sessions = [
      sessionView({ id: 'unobserved' }),
      sessionView({ id: 'ancient', lastActivityAt: 1 }),
    ]
    expect(idsOf(sessions)).toEqual(['ancient', 'unobserved'])
  })

  it('does not move a session that enters attention', () => {
    const before = [
      sessionView({ id: 'newest', lastActivityAt: 3_000 }),
      sessionView({ id: 'asking', lastActivityAt: 2_000 }),
      sessionView({ id: 'oldest', lastActivityAt: 1_000 }),
    ]
    const after = before.map((one) =>
      one.id === 'asking'
        ? sessionView({ ...one, facts: sessionFacts({ status: 'asking' }) })
        : one,
    )
    expect(idsOf(after)).toEqual(idsOf(before))
  })

  it('leaves the list of sessions it was handed untouched', () => {
    const sessions = [
      sessionView({ id: 'stale', lastActivityAt: 1_000 }),
      sessionView({ id: 'fresh', lastActivityAt: 3_000 }),
    ]
    buildSessionsRoomModel({ sessions })
    expect(sessions.map((one) => one.id)).toEqual(['stale', 'fresh'])
  })
})

describe('leaving for Archived', () => {
  const departures: [string, SessionFactsInput][] = [
    ['merged', { headSha: HEAD, pr: { num: 38, state: 'merged', base: 'main' } }],
    ['closed without merging', { headSha: HEAD, pr: { num: 35, state: 'closed', base: 'main' } }],
    ['finished', { status: 'ended' }],
  ]

  for (const [label, input] of departures) {
    it(`moves a ${label} session off the live rail by itself`, () => {
      const model = buildSessionsRoomModel({
        sessions: [sessionView({ id: 'gone', facts: sessionFacts(input) })],
      })
      expect(model.rows).toEqual([])
      expect(model.archived.map((row) => row.id)).toEqual(['gone'])
      expect(model.archivedCount).toBe(1)
    })
  }

  it('keeps every session that is still live on the rail', () => {
    const live = ['running', 'idle', 'asking', 'permission'] as const
    const sessions = live.map((status) =>
      sessionView({ id: status, facts: sessionFacts({ status }) }),
    )
    const model = buildSessionsRoomModel({ sessions })
    expect(model.rows.map((row) => row.id)).toEqual([...live])
    expect(model.archivedCount).toBe(0)
  })
})

describe('the row a rail draws', () => {
  it('spells the branch of a session Argo drives', () => {
    const driven = sessionView({ id: 'auth', branch: 'feat/auth', cwd: '/w/auth' })
    expect(rowOf(driven).place).toBe('feat/auth')
  })

  it('spells the working path of a session Argo only observes', () => {
    const watched = sessionView({
      id: 'watched',
      posture: 'external',
      branch: 'theirs',
      cwd: '/w/o',
    })
    expect(rowOf(watched).place).toBe('/w/o')
  })

  it('reads unknown for a model no record named', () => {
    expect(rowOf(sessionView({ id: 'auth', branch: 'main' })).model).toBe('unknown')
  })

  it('reads unknown where neither a branch nor a path was observed', () => {
    expect(rowOf(sessionView({ id: 'auth' })).place).toBe('unknown')
  })

  it('draws an orphaned session as an external row', () => {
    const orphaned = rowOf(sessionView({ id: 'orphaned', posture: 'orphaned', cwd: '/w/orphan' }))
    expect(orphaned.external).toBe(true)
    expect(orphaned.dot.hollow).toBe(true)
    expect(orphaned.place).toBe('/w/orphan')
  })

  it('grants no state word to a session Argo only observes', () => {
    expect(rowOf(sessionView({ id: 'watched', posture: 'external' })).word).toBe('read-only')
  })

  it('lets a delivery claim outrank the session status', () => {
    const facts = sessionFacts({
      status: 'running',
      headSha: HEAD,
      pr: { num: 42, state: 'open', base: 'main' },
      ci: { status: 'failed', sha: HEAD },
    })
    expect(rowOf(sessionView({ id: 'ci', facts })).word).toBe('CI failed')
  })

  it('marks the selected session and nothing else', () => {
    const sessions = [sessionView({ id: 'a' }), sessionView({ id: 'b' })]
    const model = buildSessionsRoomModel({ sessions, selectedId: 'b' })
    expect(model.rows.map((row) => row.selected)).toEqual([false, true])
  })
})

// Motion is no longer rationed by the rail: a dot breathes on its own state and every row asking
// for you carries the sweep, so the row's job is only to hand the derived dot through untouched.
describe('the motion a row carries', () => {
  it('breathes and asks for the sweep on every session asking for you, not just the first', () => {
    const asking = (id: string, at: number) =>
      sessionView({ id, lastActivityAt: at, facts: sessionFacts({ status: 'asking' }) })
    const sessions = [asking('first', 2_000), asking('second', 1_000)]
    const model = buildSessionsRoomModel({ sessions })
    expect(model.rows.map((row) => row.dot.pulse)).toEqual([true, true])
    expect(model.rows.map((row) => row.dot.attention)).toEqual([true, true])
  })

  it('keeps a running row breathing without the sweep, which only attention earns', () => {
    const row = rowOf(sessionView({ id: 'running' }))
    expect(row.dot.pulse).toBe(true)
    expect(row.dot.attention).toBe(false)
  })

  it('holds an idle row still', () => {
    const row = rowOf(sessionView({ id: 'idle', facts: sessionFacts({ status: 'idle' }) }))
    expect(row.dot.pulse).toBe(false)
    expect(row.dot.glow).toBe('quiet')
  })
})
