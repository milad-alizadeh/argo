import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectionDelta, ProjectView } from '../../shared'
import { createHub } from '../hub'
import {
  deriveLiveness,
  latestInChain,
  parseTranscript,
  stitch,
  toObservedSession,
  toSessionEvent,
} from './index'
import type { ObservedSession } from './types'

const parseFixture = (name: string) =>
  parseTranscript(
    name,
    readFileSync(join(__dirname, '__fixtures__', `${name}.jsonl`), 'utf8').split('\n'),
  )

// Drive the full pure pipeline (parse → stitch → liveness → observe → event) with an injected
// process match, applying each observation to a real hub — the seam's end-to-end acceptance.
function observe(
  fixtures: string[],
  processMatch: boolean,
  projects: ProjectView[] = [],
): { observed: ObservedSession[]; deltas: ProjectionDelta[] } {
  const hub = createHub()
  for (const project of projects) hub.apply({ type: 'project-registered', project })
  const deltas: ProjectionDelta[] = []
  hub.subscribe((delta) => {
    if (delta.type !== 'snapshot') deltas.push(delta)
  })

  const observed = stitch(fixtures.map(parseFixture)).map((logical) => {
    const lastTimestampMs = latestInChain(logical.files, (file) => file.lastTimestampMs)
    const nowMs = (lastTimestampMs ?? 0) + 1_000
    const status = deriveLiveness({ processMatch, lastTimestampMs, nowMs })
    const session = toObservedSession(logical, status)
    hub.apply(toSessionEvent(session))
    return session
  })

  return { observed, deltas }
}

describe('Seam B observes real claude sessions', () => {
  it('renders an external session from its transcript alone, one delta, every field graded', () => {
    const { observed, deltas } = observe(['externalBasic'], true)

    expect(deltas).toHaveLength(1)
    expect(deltas[0]).toEqual({
      type: 'session-added',
      session: {
        id: 'externalBasic',
        title: 'Refactor the auth module',
        cli: 'claude',
        cwd: '/Users/x/proj',
        projectId: null,
        facts: expect.objectContaining({ status: 'running' }),
      },
    })

    const [session] = observed
    expect(session.source).toBe('external')
    expect(session.title).toEqual({ value: 'Refactor the auth module', tier: 'derived' })
    expect(session.cwd).toEqual({ value: '/Users/x/proj', tier: 'direct' })
    expect(session.status).toEqual({ value: 'running', tier: 'derived' })
  })

  it('attributes an observed session to the registered Project its cwd sits in', () => {
    const { deltas } = observe(['externalBasic'], true, [
      { id: 'p-proj', name: 'proj', path: '/Users/x/proj' },
    ])

    expect(deltas[0]).toMatchObject({ session: { projectId: 'p-proj' } })
  })

  it('stitches a resume pair into exactly one logical session keyed to its root', () => {
    const { observed, deltas } = observe(['resumeChild', 'resumeParent'], false)

    expect(deltas).toHaveLength(1)
    const [session] = observed
    expect(session.id).toBe('resumeParent')
    expect(session.fileIds).toEqual(['resumeParent', 'resumeChild'])
    expect(deltas[0]).toMatchObject({ type: 'session-added', session: { id: 'resumeParent' } })
  })

  it('grades a session with a prose commit claim purely — nothing DIRECT off the prose', () => {
    const { observed } = observe(['adversarialNoCommit'], false)

    expect(observed).toHaveLength(1)
    const [session] = observed
    expect(session.status.tier).toBe('derived')
    // No ai-title record exists, so the title must stay DERIVED (the prompt), never DIRECT.
    expect(session.title.tier).toBe('derived')
    expect(session.title.value).toBe('Fix the bug')
    expect(session.status.value).toBe('orphaned')
  })
})
