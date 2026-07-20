import { emptyState } from '@shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './sessionStore'

beforeEach(() => {
  useSessionStore.setState(emptyState())
})

describe('useSessionStore', () => {
  it('appends a row for a session-added delta', () => {
    useSessionStore.getState().applyDelta({
      type: 'session-added',
      session: { id: 'a', title: 'A', cli: 'claude', status: 'running' },
    })
    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['a'])
  })

  it('replaces all rows for a snapshot delta', () => {
    useSessionStore.getState().applyDelta({
      type: 'session-added',
      session: { id: 'stale', title: 'stale', cli: 'claude', status: 'queued' },
    })
    useSessionStore.getState().applyDelta({
      type: 'snapshot',
      state: { sessions: [{ id: 'fresh', title: 'Fresh', cli: 'codex', status: 'queued' }] },
    })
    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['fresh'])
  })
})
