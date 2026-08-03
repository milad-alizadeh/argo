import { type CockpitState, type SessionStatus, type SessionView, sessionFacts } from '@shared'
import { describe, expect, it } from 'vitest'
import { buildShellModel } from './shellModel'

function session(id: string, projectId: string, status: SessionStatus): SessionView {
  return {
    id,
    title: id,
    cli: 'claude',
    cwd: '/code/argo',
    model: null,
    branch: null,
    lastActivityAt: null,
    projectId,
    posture: 'external',
    agents: [],
    facts: sessionFacts({ status }),
  }
}

function state(over: Partial<CockpitState> = {}): CockpitState {
  return {
    projects: [
      { id: 'p1', name: 'argo', path: '/code/argo' },
      { id: 'p2', name: 'deckhand', path: '/code/deckhand' },
    ],
    activeProjectId: 'p1',
    sessions: [],
    ...over,
  }
}

describe('the project strip', () => {
  it('renders one tab per connected project, in registration order', () => {
    expect(buildShellModel(state()).tabs.map((tab) => tab.name)).toEqual(['argo', 'deckhand'])
  })

  it('shows nothing but the add affordance when no project is connected', () => {
    const model = buildShellModel(state({ projects: [], activeProjectId: null }))
    expect(model).toMatchObject({ tabs: [], connected: false })
  })

  it('counts the shell as connected once a project is registered', () => {
    expect(buildShellModel(state()).connected).toBe(true)
  })

  it('marks only the active project active', () => {
    expect(buildShellModel(state()).tabs.map((tab) => tab.active)).toEqual([true, false])
  })

  it('labels a tab with the first letter of its project', () => {
    expect(buildShellModel(state()).tabs[1]?.initial).toBe('D')
  })

  it('keeps the active project quiet even when its own sessions want you', () => {
    const sessions = [session('s1', 'p1', 'asking')]
    expect(buildShellModel(state({ sessions })).tabs[0]?.dot).toBeNull()
  })

  it('badges a background project with its worst session state', () => {
    const sessions = [session('s1', 'p2', 'running'), session('s2', 'p2', 'stopped')]
    expect(buildShellModel(state({ sessions })).tabs[1]?.dot).toBe('red')
  })
})
