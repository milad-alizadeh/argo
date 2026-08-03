import type { SessionStatus, SessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import type { RosterTone } from '@/shared/delivery'
import { worstStateDot } from './worstStateDot'

function session(status: SessionStatus, projectId: string | null = 'p1'): SessionView {
  return {
    id: `s-${status}-${projectId}`,
    title: status,
    cli: 'claude',
    cwd: '/code/argo',
    projectId,
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
    { rosterOf: 'a session waiting on you', status: 'needs-input', dot: 'amber' },
    { rosterOf: 'a failed session', status: 'failed', dot: 'red' },
    { rosterOf: 'a running session', status: 'running', dot: 'run' },
    { rosterOf: 'only finished work', status: 'done', dot: null },
    { rosterOf: 'an orphaned session', status: 'orphaned', dot: null },
  ]

  it.each(ONE_SESSION)('shows $dot for $rosterOf', ({ status, dot }) => {
    expect(worstStateDot([session(status)], 'p1')).toBe(dot)
  })

  it('shows the worst state when a project holds several', () => {
    const roster = [session('running'), session('failed'), session('needs-input')]
    expect(worstStateDot(roster, 'p1')).toBe('amber')
  })

  it('prefers a failure over anything still running', () => {
    expect(worstStateDot([session('running'), session('failed')], 'p1')).toBe('red')
  })

  it('ignores sessions belonging to another project', () => {
    expect(worstStateDot([session('failed', 'p2')], 'p1')).toBeNull()
  })

  it('ignores sessions that fell into no project', () => {
    expect(worstStateDot([session('failed', null)], 'p1')).toBeNull()
  })
})
