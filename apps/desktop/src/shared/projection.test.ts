import { describe, expect, it } from 'vitest'
import { type CockpitState, emptyState, type SessionIntake } from './cockpitState'
import { applyDelta, applyEvent, type HubEvent } from './projection'
import type { ProjectView } from './projects'
import { sessionFacts } from './sessionFacts'

// Seam A, pure: main-side `applyEvent` turns events into deltas; renderer-side
// `applyDelta` replays those deltas into projected state. This exercises the whole
// projection contract end-to-end. The rendered-roster half of the Seam A criterion
// lives in Roster.stories.tsx — a browser/renderer test cannot import main-process
// code across the Electron module boundary, so the seam is asserted in two places
// that share the same `SessionView` type (drift is a compile error).
function replay(events: HubEvent[]): { hub: CockpitState; projected: CockpitState } {
  let hub = emptyState()
  let projected = emptyState()
  for (const event of events) {
    const result = applyEvent(hub, event)
    hub = result.state
    for (const delta of result.deltas) projected = applyDelta(projected, delta)
  }
  return { hub, projected }
}

const session = (over: Partial<SessionIntake> = {}): SessionIntake => ({
  id: 's1',
  title: 'Refactor auth module',
  cli: 'claude',
  cwd: null,
  posture: 'external',
  facts: sessionFacts(),
  agents: [],
  ...over,
})

const argo: ProjectView = { id: 'p-argo', name: 'argo', path: '/Users/dev/code/argo' }
const shop: ProjectView = { id: 'p-shop', name: 'shop', path: '/Users/dev/code/shop' }

const registered = (project: ProjectView): HubEvent => ({ type: 'project-registered', project })
const created = (over: Partial<SessionIntake> = {}): HubEvent => ({
  type: 'session-created',
  session: session(over),
})

describe('Seam A projection', () => {
  it('projects an empty roster from an empty event stream', () => {
    expect(replay([]).projected.sessions).toEqual([])
  })

  it('projects one roster row from a session-created event', () => {
    const { projected } = replay([created()])
    expect(projected.sessions).toEqual([{ ...session(), projectId: null }])
  })

  it('projects each created Session, preserving order', () => {
    const { projected } = replay([
      created({ id: 'a', title: 'A' }),
      created({ id: 'b', title: 'B', cli: 'codex' }),
    ])
    expect(projected.sessions.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('ignores a duplicate session-created (idempotent intake)', () => {
    const { hub, projected } = replay([
      created({ id: 'a' }),
      created({ id: 'a', title: 'changed' }),
    ])
    expect(hub.sessions).toHaveLength(1)
    expect(projected.sessions).toHaveLength(1)
    expect(projected.sessions[0]?.title).toBe('Refactor auth module')
  })

  it('rehydrates projected state wholesale from a snapshot delta', () => {
    const fresh = replay([created({ id: 'fresh' })]).hub
    const stale = replay([created({ id: 'stale' })]).hub

    expect(applyDelta(stale, { type: 'snapshot', state: fresh }).sessions.map((s) => s.id)).toEqual(
      ['fresh'],
    )
  })
})

describe('the Project registry in projected state', () => {
  it('projects a registered Project into the known set', () => {
    expect(replay([registered(argo)]).projected.projects).toEqual([argo])
  })

  it('makes the first registered Project the active one', () => {
    expect(replay([registered(argo)]).projected.activeProjectId).toBe('p-argo')
  })

  it('leaves the active Project alone when a second one registers', () => {
    const { projected } = replay([registered(argo), registered(shop)])
    expect(projected.activeProjectId).toBe('p-argo')
  })

  it('ignores a Project that is already registered', () => {
    const { hub } = replay([registered(argo), registered(argo)])
    expect(hub.projects).toHaveLength(1)
  })

  it('switches the active Project when one is activated', () => {
    const { projected } = replay([
      registered(argo),
      registered(shop),
      { type: 'project-activated', id: 'p-shop' },
    ])
    expect(projected.activeProjectId).toBe('p-shop')
  })

  it.each<[string, HubEvent]>([
    ['activated', { type: 'project-activated', id: 'p-ghost' }],
    ['relocated', { type: 'project-relocated', id: 'p-ghost', path: '/tmp/ghost' }],
  ])('changes nothing when a Project that is not registered is %s', (_, event) => {
    expect(replay([registered(argo), event]).hub).toEqual(replay([registered(argo)]).hub)
  })

  it('keeps a relocated Project id and re-points its path and name', () => {
    const { projected } = replay([
      registered(argo),
      { type: 'project-relocated', id: 'p-argo', path: '/Volumes/ssd/argo-moved' },
    ])
    expect(projected.projects).toEqual([
      { id: 'p-argo', name: 'argo-moved', path: '/Volumes/ssd/argo-moved' },
    ])
  })
})

describe('attributing observed Sessions to a Project', () => {
  it('attributes a Session to the Project its cwd sits in', () => {
    const { projected } = replay([
      registered(argo),
      created({ id: 'a', cwd: '/Users/dev/code/argo/.claude/worktrees/ticket-9' }),
    ])
    expect(projected.sessions[0]?.projectId).toBe('p-argo')
  })

  it('leaves a Session outside every registered Project unattributed', () => {
    const { projected } = replay([registered(argo), created({ id: 'a', cwd: '/Users/dev/other' })])
    expect(projected.sessions[0]?.projectId).toBeNull()
  })

  it('attributes Sessions the launch sweep observed before the Project was registered', () => {
    const { projected } = replay([
      created({ id: 'a', cwd: '/Users/dev/code/argo/src' }),
      registered(argo),
    ])
    expect(projected.sessions[0]?.projectId).toBe('p-argo')
  })

  it('re-attributes Sessions when the Project folder relocates', () => {
    const { projected } = replay([
      registered(argo),
      created({ id: 'a', cwd: '/Users/dev/code/argo/src' }),
      { type: 'project-relocated', id: 'p-argo', path: '/Volumes/ssd/argo' },
    ])
    expect(projected.sessions[0]?.projectId).toBeNull()
  })

  it('replays a full delta stream into state identical to the hub copy', () => {
    const { hub, projected } = replay([
      registered(argo),
      created({ id: 'a', cwd: '/Users/dev/code/argo/src' }),
      registered(shop),
      created({ id: 'b', cwd: '/Users/dev/code/shop' }),
      created({ id: 'c', cwd: '/Users/dev/elsewhere' }),
      { type: 'project-activated', id: 'p-shop' },
      { type: 'project-relocated', id: 'p-argo', path: '/Volumes/ssd/argo' },
    ])
    expect(projected).toEqual(hub)
  })
})
