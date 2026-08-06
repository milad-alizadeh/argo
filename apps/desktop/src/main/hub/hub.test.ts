import { describe, expect, it, vi } from 'vitest'
import {
  emptyState,
  type HubEvent,
  type ProjectionDelta,
  type SessionIntake,
  type SessionView,
  sessionFacts,
} from '../../shared'
import { createHub } from './hub'

const intake = (id: string): SessionIntake => ({
  id,
  title: id,
  cli: 'claude',
  cwd: null,
  model: null,
  branch: null,
  lastActivityAt: null,
  posture: 'external',
  facts: sessionFacts(),
  agents: [
    {
      id,
      parentId: null,
      turns: [],
      compactions: [],
      startedAtMs: null,
      endedAtMs: null,
      usage: null,
    },
  ],
})

const created = (id: string): HubEvent => ({ type: 'session-created', session: intake(id) })

const projected = (id: string): SessionView => ({ ...intake(id), projectId: null })

describe('createHub', () => {
  it('hydrates a new subscriber with a snapshot of current state', () => {
    const hub = createHub()
    hub.apply(created('a'))

    const deltas: ProjectionDelta[] = []
    hub.subscribe((delta) => deltas.push(delta))

    expect(deltas).toEqual([
      { type: 'snapshot', state: { ...emptyState(), sessions: [projected('a')] } },
    ])
  })

  it('pushes a session-added delta to subscribers when an event is applied', () => {
    const hub = createHub()
    const deltas: ProjectionDelta[] = []
    hub.subscribe((delta) => deltas.push(delta))

    hub.apply(created('a'))

    expect(deltas).toContainEqual({ type: 'session-added', session: projected('a') })
  })

  it('stops delivering after unsubscribe', () => {
    const hub = createHub()
    const listener = vi.fn()
    const unsubscribe = hub.subscribe(listener)
    unsubscribe()

    hub.apply(created('a'))

    // Only the initial hydrating snapshot was delivered; nothing after unsubscribe.
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ type: 'snapshot', state: emptyState() })
  })

  it('exposes authoritative state through getState', () => {
    const hub = createHub()
    hub.apply(created('a'))
    hub.apply(created('b'))
    expect(hub.getState().sessions.map((s) => s.id)).toEqual(['a', 'b'])
  })
})
