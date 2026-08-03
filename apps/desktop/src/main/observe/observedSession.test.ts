import { describe, expect, it } from 'vitest'
import { derived, rootAgent, subagentsOf } from '../../shared'
import { toObservedSession, toSessionUpdate } from './observedSession'
import type { LogicalSession, ParsedTranscript } from './types'

const file = (over: Partial<ParsedTranscript>): ParsedTranscript => ({
  sessionId: 'file-1',
  headLeafUuid: null,
  messageUuids: [],
  cwd: null,
  aiTitle: null,
  firstPrompt: null,
  lastTimestampMs: null,
  tree: { turns: [], compactions: [], subagents: [] },
  ...over,
})

const logicalOf = (...files: ParsedTranscript[]): LogicalSession => ({
  id: files[0].sessionId,
  fileIds: files.map((entry) => entry.sessionId),
  files,
})

const running = () => derived('running' as const)

const turn = (id: string) => ({
  id,
  stopReason: null,
  toolCalls: [],
  plan: null,
  usage: null,
  endedAtMs: null,
})

describe('toObservedSession', () => {
  it('grades an ai-title as DIRECT and cwd as DIRECT', () => {
    const leaf = file({ aiTitle: 'Auth refactor', cwd: '/Users/x/proj', firstPrompt: 'ignored' })
    const observed = toObservedSession(logicalOf(leaf), 'external', running)

    expect(observed.title).toEqual({ value: 'Auth refactor', tier: 'direct' })
    expect(observed.cwd).toEqual({ value: '/Users/x/proj', tier: 'direct' })
    expect(observed.posture).toBe('external')
  })

  it('falls back to the first prompt as a DERIVED title when no ai-title exists', () => {
    const leaf = file({ firstPrompt: 'Fix the bug' })
    const observed = toObservedSession(logicalOf(leaf), 'external', () => derived('idle'))

    expect(observed.title).toEqual({ value: 'Fix the bug', tier: 'derived' })
    expect(observed.cwd).toBeNull()
    expect(observed.status).toEqual({ value: 'idle', tier: 'derived' })
  })

  it('uses a DERIVED placeholder when neither title source is present', () => {
    const observed = toObservedSession(logicalOf(file({})), 'external', running)
    expect(observed.title).toEqual({ value: 'Untitled session', tier: 'derived' })
  })

  it('makes the Session the ROOT Agent, keyed by parentId with no kind discriminant', () => {
    const observed = toObservedSession(logicalOf(file({})), 'external', running)
    const root = rootAgent(observed.agents)

    expect(root).toEqual({ id: 'file-1', parentId: null, turns: [], compactions: [] })
    expect(Object.keys(root ?? {})).not.toContain('kind')
  })

  it('concatenates the chain’s turns onto one root Agent, in root → leaf order', () => {
    const root = file({
      sessionId: 'chain-root',
      tree: { turns: [turn('t1')], compactions: [], subagents: [] },
    })
    const leaf = file({
      sessionId: 'chain-leaf',
      tree: { turns: [turn('t2')], compactions: [{ beforeTurnId: 't2' }], subagents: [] },
    })
    const observed = toObservedSession(logicalOf(root, leaf), 'external', running)

    expect(rootAgent(observed.agents)?.turns.map((entry) => entry.id)).toEqual(['t1', 't2'])
    expect(rootAgent(observed.agents)?.compactions).toEqual([{ beforeTurnId: 't2' }])
  })

  it('parents every Subagent to the root and keeps an unreported label absent', () => {
    const leaf = file({
      tree: {
        turns: [],
        compactions: [],
        subagents: [{ id: 'sub-1', label: 'research: chains' }, { id: 'sub-2' }],
      },
    })
    const observed = toObservedSession(logicalOf(leaf), 'external', running)

    expect(subagentsOf(observed.agents, 'file-1')).toEqual([
      { id: 'sub-1', label: 'research: chains', parentId: 'file-1', turns: [], compactions: [] },
      { id: 'sub-2', parentId: 'file-1', turns: [], compactions: [] },
    ])
  })
})

describe('the Seam B → Seam A events', () => {
  it('carries the graded value, the posture and the tree — never the honesty tiers', () => {
    const leaf = file({ aiTitle: 'Auth refactor', cwd: '/Users/x/proj' })
    const event = toSessionUpdate(toObservedSession(logicalOf(leaf), 'orphaned', running))

    expect(event.type).toBe('session-updated')
    expect(event.session.id).toBe('file-1')
    expect(event.session.title).toBe('Auth refactor')
    expect(event.session.cli).toBe('claude')
    expect(event.session.posture).toBe('orphaned')
    expect(event.session.facts.status).toBe('running')
    expect(event.session.agents).toHaveLength(1)
    expect(JSON.stringify(event.session)).not.toContain('tier')
  })
})
