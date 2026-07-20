import { describe, expect, it } from 'vitest'
import { applyDelta, applyEvent, emptyState, type HubEvent, type SessionView } from './projection'
import { sessionFacts } from './sessionFacts'

// Seam A, pure: main-side `applyEvent` turns events into deltas; renderer-side
// `applyDelta` replays those deltas into projected state. This exercises the whole
// projection contract end-to-end. The rendered-rail half of the Seam A criterion
// lives in Rail.stories.tsx — a browser/renderer test cannot import main-process
// code across the Electron module boundary, so the seam is asserted in two places
// that share the same `SessionView` type (drift is a compile error).
function project(events: HubEvent[]): {
  hub: ReturnType<typeof emptyState>
  projected: ReturnType<typeof emptyState>
} {
  let hub = emptyState()
  let projected = emptyState()
  for (const event of events) {
    const result = applyEvent(hub, event)
    hub = result.state
    for (const delta of result.deltas) projected = applyDelta(projected, delta)
  }
  return { hub, projected }
}

const session = (over: Partial<SessionView> = {}): SessionView => ({
  id: 's1',
  title: 'Refactor auth module',
  cli: 'claude',
  facts: sessionFacts(),
  ...over,
})

describe('Seam A projection', () => {
  it('projects an empty rail from an empty event stream', () => {
    expect(project([]).projected.sessions).toEqual([])
  })

  it('projects one rail row from a session-created event', () => {
    const { projected } = project([{ type: 'session-created', session: session() }])
    expect(projected.sessions).toEqual([session()])
  })

  it('projects each created Session, preserving order', () => {
    const { projected } = project([
      { type: 'session-created', session: session({ id: 'a', title: 'A' }) },
      { type: 'session-created', session: session({ id: 'b', title: 'B', cli: 'codex' }) },
    ])
    expect(projected.sessions.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('ignores a duplicate session-created (idempotent intake)', () => {
    const { hub, projected } = project([
      { type: 'session-created', session: session({ id: 'a' }) },
      { type: 'session-created', session: session({ id: 'a', title: 'changed' }) },
    ])
    expect(hub.sessions).toHaveLength(1)
    expect(projected.sessions).toHaveLength(1)
    expect(projected.sessions[0]?.title).toBe('Refactor auth module')
  })

  it('rehydrates projected state wholesale from a snapshot delta', () => {
    const stale = { sessions: [session({ id: 'stale' })] }
    const next = applyDelta(stale, {
      type: 'snapshot',
      state: { sessions: [session({ id: 'fresh' })] },
    })
    expect(next.sessions.map((s) => s.id)).toEqual(['fresh'])
  })
})
