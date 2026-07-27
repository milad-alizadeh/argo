import { emptyState, type SessionView, sessionFacts } from '@shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './sessionStore'

beforeEach(() => {
  useSessionStore.setState(emptyState())
})

const row = (id: string, over: Partial<SessionView> = {}): SessionView => ({
  id,
  title: id,
  cli: 'claude',
  cwd: null,
  projectId: null,
  facts: sessionFacts(),
  ...over,
})

describe('useSessionStore', () => {
  it('appends a row for a session-added delta', () => {
    useSessionStore.getState().applyDelta({ type: 'session-added', session: row('a') })
    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['a'])
  })

  it('replaces all rows for a snapshot delta', () => {
    useSessionStore.getState().applyDelta({ type: 'session-added', session: row('stale') })
    useSessionStore.getState().applyDelta({
      type: 'snapshot',
      state: { ...emptyState(), sessions: [row('fresh', { cli: 'codex' })] },
    })
    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['fresh'])
  })

  it('holds the registered Projects a snapshot hydrates it with', () => {
    useSessionStore.getState().applyDelta({
      type: 'snapshot',
      state: {
        projects: [{ id: 'p-argo', name: 'argo', path: '/Users/dev/code/argo' }],
        activeProjectId: 'p-argo',
        sessions: [],
      },
    })
    expect(useSessionStore.getState().activeProjectId).toBe('p-argo')
  })
})
