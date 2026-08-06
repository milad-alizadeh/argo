import { emptyState, type SessionView, sessionFacts } from '@shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { currentSessionId, useSessionStore } from './sessionStore'

beforeEach(() => {
  useSessionStore.setState({ ...emptyState(), successors: {} })
})

const row = (id: string, over: Partial<SessionView> = {}): SessionView => ({
  id,
  title: id,
  cli: 'claude',
  cwd: null,
  model: null,
  branch: null,
  lastActivityAt: null,
  projectId: null,
  posture: 'external',
  agents: [],
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

  it('puts the Session the CLI named where the row Argo spawned stood', () => {
    useSessionStore.getState().applyDelta({ type: 'session-added', session: row('claim-1') })
    useSessionStore
      .getState()
      .applyDelta({ type: 'session-replaced', provisionalId: 'claim-1', session: row('s1') })

    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['s1'])
  })

  it('follows a selection made before the CLI named the Session', () => {
    useSessionStore
      .getState()
      .applyDelta({ type: 'session-replaced', provisionalId: 'claim-1', session: row('s1') })

    expect(currentSessionId(useSessionStore.getState().successors, 'claim-1')).toBe('s1')
  })

  it.each<[string, string | null]>([
    ['a row nothing replaced', 'other'],
    ['no selection at all', null],
  ])('leaves %s alone', (_, selected) => {
    expect(currentSessionId({ 'claim-1': 's1' }, selected)).toBe(selected)
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
