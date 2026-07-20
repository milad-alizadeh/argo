import { describe, expect, it, vi } from 'vitest'
import type { HubEvent, ProjectionDelta } from '../shared'
import { createHub } from './hub'

const created = (id: string): HubEvent => ({
  type: 'session-created',
  session: { id, title: id, cli: 'claude', status: 'running' },
})

describe('createHub', () => {
  it('hydrates a new subscriber with a snapshot of current state', () => {
    const hub = createHub()
    hub.apply(created('a'))

    const deltas: ProjectionDelta[] = []
    hub.subscribe((delta) => deltas.push(delta))

    expect(deltas).toEqual([{ type: 'snapshot', state: { sessions: [created('a').session] } }])
  })

  it('pushes a session-added delta to subscribers when an event is applied', () => {
    const hub = createHub()
    const deltas: ProjectionDelta[] = []
    hub.subscribe((delta) => deltas.push(delta))

    hub.apply(created('a'))

    expect(deltas).toContainEqual({ type: 'session-added', session: created('a').session })
  })

  it('stops delivering after unsubscribe', () => {
    const hub = createHub()
    const listener = vi.fn()
    const unsubscribe = hub.subscribe(listener)
    unsubscribe()

    hub.apply(created('a'))

    // Only the initial hydrating snapshot was delivered; nothing after unsubscribe.
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ type: 'snapshot', state: { sessions: [] } })
  })

  it('exposes authoritative state through getState', () => {
    const hub = createHub()
    hub.apply(created('a'))
    hub.apply(created('b'))
    expect(hub.getState().sessions.map((s) => s.id)).toEqual(['a', 'b'])
  })
})
