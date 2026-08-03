import { describe, expect, it } from 'vitest'
import { derived, rootAgent } from '../../shared'
import { toObservedSession, toSessionUpdate } from './observedSession'
import type { LogicalSession, ParsedTranscript } from './types'

const file = (over: Partial<ParsedTranscript>): ParsedTranscript => ({
  sessionId: 'file-1',
  headLeafUuid: null,
  messageUuids: [],
  cwd: null,
  model: null,
  gitBranch: null,
  aiTitle: null,
  firstPrompt: null,
  firstTimestampMs: null,
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

    expect(observed.agents.filter((agent) => agent.parentId === 'file-1')).toEqual([
      { id: 'sub-1', label: 'research: chains', parentId: 'file-1', turns: [], compactions: [] },
      { id: 'sub-2', parentId: 'file-1', turns: [], compactions: [] },
    ])
  })
})

describe('the roster row’s model, branch and recency', () => {
  it('grades an observed model and branch as DIRECT', () => {
    const leaf = file({ model: 'claude-opus-5', gitBranch: 'argo/#267' })
    const observed = toObservedSession(logicalOf(leaf), 'external', running)

    expect(observed.model).toEqual({ value: 'claude-opus-5', tier: 'direct' })
    expect(observed.branch).toEqual({ value: 'argo/#267', tier: 'direct' })
  })

  it('falls back across the chain when the leaf file reports neither', () => {
    const root = file({ sessionId: 'chain-root', model: 'claude-opus-5', gitBranch: 'main' })
    const leaf = file({ sessionId: 'chain-leaf' })
    const observed = toObservedSession(logicalOf(root, leaf), 'external', running)

    expect(observed.model?.value).toBe('claude-opus-5')
    expect(observed.branch?.value).toBe('main')
  })

  it('lets the leaf file’s reading win over an earlier one', () => {
    const root = file({ sessionId: 'chain-root', model: 'claude-sonnet-4-5', gitBranch: 'main' })
    const leaf = file({ sessionId: 'chain-leaf', model: 'claude-opus-5', gitBranch: 'argo/#267' })
    const observed = toObservedSession(logicalOf(root, leaf), 'external', running)

    expect(observed.model?.value).toBe('claude-opus-5')
    expect(observed.branch?.value).toBe('argo/#267')
  })

  it('takes lastActivityAt as the MAX across the chain, not the leaf-most reading', () => {
    const root = file({ sessionId: 'chain-root', lastTimestampMs: 3_000 })
    const leaf = file({ sessionId: 'chain-leaf', lastTimestampMs: 1_000 })
    const observed = toObservedSession(logicalOf(root, leaf), 'external', running)

    expect(observed.lastActivityAt).toEqual({ value: 3_000, tier: 'derived' })
  })

  it('leaves all three null when nothing observed them', () => {
    const observed = toObservedSession(logicalOf(file({})), 'external', running)

    expect(observed.model).toBeNull()
    expect(observed.branch).toBeNull()
    expect(observed.lastActivityAt).toBeNull()
  })

  it('carries all three onto the intake the roster reads', () => {
    const root = file({ sessionId: 'chain-root', lastTimestampMs: 9_000 })
    const leaf = file({ sessionId: 'chain-leaf', model: 'claude-opus-5', gitBranch: 'main' })
    const event = toSessionUpdate(toObservedSession(logicalOf(root, leaf), 'external', running))

    expect(event.session.model).toBe('claude-opus-5')
    expect(event.session.branch).toBe('main')
    expect(event.session.lastActivityAt).toBe(9_000)
  })

  it('ships nulls on the intake rather than a stand-in value', () => {
    const event = toSessionUpdate(toObservedSession(logicalOf(file({})), 'external', running))

    expect(event.session.model).toBeNull()
    expect(event.session.branch).toBeNull()
    expect(event.session.lastActivityAt).toBeNull()
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
