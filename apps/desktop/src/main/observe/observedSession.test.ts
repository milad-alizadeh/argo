import { describe, expect, it } from 'vitest'
import { derived } from '../../shared'
import { toObservedSession, toSessionEvent } from './observedSession'
import type { LogicalSession, ParsedTranscript } from './types'

const file = (over: Partial<ParsedTranscript>): ParsedTranscript => ({
  sessionId: 'file-1',
  headLeafUuid: null,
  messageUuids: [],
  cwd: null,
  aiTitle: null,
  firstPrompt: null,
  lastTimestampMs: null,
  ...over,
})

const logicalOf = (leaf: ParsedTranscript): LogicalSession => ({
  id: leaf.sessionId,
  fileIds: [leaf.sessionId],
  files: [leaf],
})

describe('toObservedSession', () => {
  it('grades an ai-title as DIRECT and cwd as DIRECT', () => {
    const leaf = file({ aiTitle: 'Auth refactor', cwd: '/Users/x/proj', firstPrompt: 'ignored' })
    const observed = toObservedSession(logicalOf(leaf), derived('running'))

    expect(observed.title).toEqual({ value: 'Auth refactor', tier: 'direct' })
    expect(observed.cwd).toEqual({ value: '/Users/x/proj', tier: 'direct' })
    expect(observed.source).toBe('external')
  })

  it('falls back to the first prompt as a DERIVED title when no ai-title exists', () => {
    const leaf = file({ firstPrompt: 'Fix the bug' })
    const observed = toObservedSession(logicalOf(leaf), derived('orphaned'))

    expect(observed.title).toEqual({ value: 'Fix the bug', tier: 'derived' })
    expect(observed.cwd).toBeNull()
    expect(observed.status).toEqual({ value: 'orphaned', tier: 'derived' })
  })

  it('uses a DERIVED placeholder when neither title source is present', () => {
    const observed = toObservedSession(logicalOf(file({})), derived('running'))
    expect(observed.title).toEqual({ value: 'Untitled session', tier: 'derived' })
  })
})

describe('toSessionEvent', () => {
  it('emits a session-created carrying only the graded value on facts.status', () => {
    const leaf = file({ aiTitle: 'Auth refactor', cwd: '/Users/x/proj' })
    const event = toSessionEvent(toObservedSession(logicalOf(leaf), derived('running')))

    expect(event.type).toBe('session-created')
    expect(event.session.id).toBe('file-1')
    expect(event.session.title).toBe('Auth refactor')
    expect(event.session.cli).toBe('claude')
    expect(event.session.facts.status).toBe('running')
  })
})
