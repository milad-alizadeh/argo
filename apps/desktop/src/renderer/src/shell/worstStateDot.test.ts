import type { SessionStatus, SessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import type { RosterTone } from '@/shared/status'
import { worstStateDot } from './worstStateDot'

function session(status: SessionStatus, projectId: string | null = 'p1'): SessionView {
  return {
    id: `s-${status}-${projectId}`,
    title: status,
    cli: 'claude',
    cwd: '/code/argo',
    projectId,
    posture: 'external',
    agents: [],
    facts: {
      status,
      agent: 'idle',
      dirty: 0,
      unpushed: 0,
      headSha: null,
      pr: null,
      ci: null,
      review: [],
      policy: { createPr: 'ask', merge: 'ask', pushAfterPr: 'manual' },
    },
  }
}

describe('the project strip dot', () => {
  it('says nothing about a project with no sessions', () => {
    expect(worstStateDot([], 'p1')).toBeNull()
  })

  const ONE_SESSION: { rosterOf: string; status: SessionStatus; dot: RosterTone | null }[] = [
    { rosterOf: 'a session blocked on a permission', status: 'permission', dot: 'amber' },
    { rosterOf: 'a session blocked on a question', status: 'asking', dot: 'amber' },
    { rosterOf: 'a stopped session', status: 'stopped', dot: 'red' },
    { rosterOf: 'a running session', status: 'running', dot: 'run' },
    { rosterOf: 'an idle session', status: 'idle', dot: null },
    { rosterOf: 'an ended session', status: 'ended', dot: null },
  ]

  it.each(ONE_SESSION)('shows $dot for $rosterOf', ({ status, dot }) => {
    expect(worstStateDot([session(status)], 'p1')).toBe(dot)
  })

  it('shows the worst state when a project holds several', () => {
    const roster = [session('running'), session('stopped'), session('asking')]
    expect(worstStateDot(roster, 'p1')).toBe('amber')
  })

  it('prefers a failure over anything still running', () => {
    expect(worstStateDot([session('running'), session('stopped')], 'p1')).toBe('red')
  })

  it('ignores sessions belonging to another project', () => {
    expect(worstStateDot([session('stopped', 'p2')], 'p1')).toBeNull()
  })

  it('ignores sessions that fell into no project', () => {
    expect(worstStateDot([session('stopped', null)], 'p1')).toBeNull()
  })
})
