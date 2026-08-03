import { type SessionFactsInput, type SessionView, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { buildSessionsRoomModel } from './sessionsRoomModel'

// The rail's contract as arithmetic (`cockpit-spec.md` §4.1): what order the rows come in, which
// sessions have already left for Archived, and what each row spells. None of it needs a browser.

const HEAD = 'a1b2c3d'

const session = (over: Partial<SessionView> & { id: string }): SessionView => ({
  title: `Session ${over.id}`,
  cli: 'claude',
  cwd: null,
  model: null,
  branch: null,
  lastActivityAt: null,
  projectId: null,
  posture: 'managed',
  agents: [],
  facts: sessionFacts(),
  ...over,
})

const idsOf = (sessions: readonly SessionView[]): string[] =>
  buildSessionsRoomModel({ sessions }).rows.map((row) => row.id)

const rowFor = (one: SessionView) => {
  const [row] = buildSessionsRoomModel({ sessions: [one] }).rows
  if (row === undefined) throw new Error(`${one.id} left the live rail`)
  return row
}

describe('the rail order', () => {
  it('lists the most recently active session first', () => {
    const sessions = [
      session({ id: 'stale', lastActivityAt: 1_000 }),
      session({ id: 'fresh', lastActivityAt: 3_000 }),
      session({ id: 'middling', lastActivityAt: 2_000 }),
    ]
    expect(idsOf(sessions)).toEqual(['fresh', 'middling', 'stale'])
  })

  it('keeps the incoming order between sessions last active at the same moment', () => {
    const at = (id: string) => session({ id, lastActivityAt: 5_000 })
    expect(idsOf([at('first'), at('second'), at('third')])).toEqual(['first', 'second', 'third'])
  })

  it('sorts a session whose activity was never observed last', () => {
    const sessions = [session({ id: 'unobserved' }), session({ id: 'ancient', lastActivityAt: 1 })]
    expect(idsOf(sessions)).toEqual(['ancient', 'unobserved'])
  })

  it('does not move a session that enters attention', () => {
    const before = [
      session({ id: 'newest', lastActivityAt: 3_000 }),
      session({ id: 'asking', lastActivityAt: 2_000 }),
      session({ id: 'oldest', lastActivityAt: 1_000 }),
    ]
    const after = before.map((one) =>
      one.id === 'asking' ? session({ ...one, facts: sessionFacts({ status: 'asking' }) }) : one,
    )
    expect(idsOf(after)).toEqual(idsOf(before))
  })

  it('leaves the list of sessions it was handed untouched', () => {
    const sessions = [
      session({ id: 'stale', lastActivityAt: 1_000 }),
      session({ id: 'fresh', lastActivityAt: 3_000 }),
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
        sessions: [session({ id: 'gone', facts: sessionFacts(input) })],
      })
      expect(model.rows).toEqual([])
      expect(model.archived.map((row) => row.id)).toEqual(['gone'])
      expect(model.archivedCount).toBe(1)
    })
  }

  it('keeps every session that is still live on the rail', () => {
    const live = ['running', 'idle', 'asking', 'permission'] as const
    const sessions = live.map((status) => session({ id: status, facts: sessionFacts({ status }) }))
    const model = buildSessionsRoomModel({ sessions })
    expect(model.rows.map((row) => row.id)).toEqual([...live])
    expect(model.archivedCount).toBe(0)
  })
})

describe('the row a rail draws', () => {
  it('spells the branch of a session Argo drives', () => {
    const driven = session({ id: 'auth', branch: 'feat/auth', cwd: '/w/auth' })
    expect(rowFor(driven).place).toBe('feat/auth')
  })

  it('spells the working path of a session Argo only observes', () => {
    const watched = session({ id: 'watched', posture: 'external', branch: 'theirs', cwd: '/w/o' })
    expect(rowFor(watched).place).toBe('/w/o')
  })

  it('reads unknown for a model no record named', () => {
    expect(rowFor(session({ id: 'auth', branch: 'main' })).model).toBe('unknown')
  })

  it('reads unknown where neither a branch nor a path was observed', () => {
    expect(rowFor(session({ id: 'auth' })).place).toBe('unknown')
  })

  it('draws an orphaned session as an external row', () => {
    const orphaned = rowFor(session({ id: 'orphaned', posture: 'orphaned', cwd: '/w/orphan' }))
    expect(orphaned.external).toBe(true)
    expect(orphaned.dot.hollow).toBe(true)
    expect(orphaned.place).toBe('/w/orphan')
  })

  it('grants no state word to a session Argo only observes', () => {
    expect(rowFor(session({ id: 'watched', posture: 'external' })).word).toBe('read-only')
  })

  it('lets a delivery claim outrank the session status', () => {
    const facts = sessionFacts({
      status: 'running',
      headSha: HEAD,
      pr: { num: 42, state: 'open', base: 'main' },
      ci: { status: 'failed', sha: HEAD },
    })
    expect(rowFor(session({ id: 'ci', facts })).word).toBe('CI failed')
  })

  it('marks the selected session and nothing else', () => {
    const sessions = [session({ id: 'a' }), session({ id: 'b' })]
    const model = buildSessionsRoomModel({ sessions, selectedId: 'b' })
    expect(model.rows.map((row) => row.selected)).toEqual([false, true])
  })
})

describe('the one pulse budget', () => {
  it('spends it on the first session asking for you', () => {
    const sessions = [
      session({ id: 'running', lastActivityAt: 2_000 }),
      session({ id: 'asking', lastActivityAt: 1_000, facts: sessionFacts({ status: 'asking' }) }),
    ]
    expect(buildSessionsRoomModel({ sessions }).rows.map((row) => row.pulse)).toEqual([false, true])
  })

  it('spends nothing while the selected session has a stalled lifecycle of its own', () => {
    const facts = sessionFacts({ headSha: HEAD, dirty: 3, agent: 'idle', status: 'permission' })
    const sessions = [session({ id: 'commit-ready', facts })]
    const model = buildSessionsRoomModel({ sessions, selectedId: 'commit-ready' })
    expect(model.rows.map((row) => row.pulse)).toEqual([false])
  })
})
