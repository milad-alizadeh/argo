import { sessionFacts, sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { buildInteriorHeader, type SessionLink } from './interiorHeader'

const MINUTE = 60_000
const NOW = 100 * MINUTE

const link = (over: Partial<SessionLink> = {}): SessionLink => ({
  titleSource: 'derived',
  intent: null,
  mode: null,
  ...over,
})

const textOf = (segments: readonly { text: string }[]): string[] => segments.map(({ text }) => text)

describe('buildInteriorHeader', () => {
  it('renders the title the observer resolved, untouched', () => {
    const header = buildInteriorHeader({
      session: sessionView({ id: 's', title: 'Auth refactor' }),
    })
    expect(header.title).toBe('Auth refactor')
  })

  it('orders the meta line status · model · mode · branch · elapsed', () => {
    const session = sessionView({
      id: 's',
      model: 'claude-opus-5',
      branch: 'feat/auth',
      lastActivityAt: NOW - 8 * MINUTE,
      facts: sessionFacts({ status: 'idle', dirty: 3, unpushed: 2 }),
    })
    const header = buildInteriorHeader({ session, link: link({ mode: 'Plan' }), nowMs: NOW })
    expect(header.meta.map(({ id }) => id)).toEqual([
      'status',
      'model',
      'mode',
      'branch',
      'elapsed',
    ])
    expect(textOf(header.meta)).toEqual(['idle', 'claude-opus-5', 'Plan', '3∆ ↑2', 'idle 8m'])
  })

  it('says `unknown` for the model and the mode rather than defaulting them', () => {
    const header = buildInteriorHeader({ session: sessionView({ id: 's' }) })
    const spoken = new Map(header.meta.map(({ id, text }) => [id, text]))
    expect(spoken.get('model')).toBe('unknown')
    expect(spoken.get('mode')).toBe('unknown')
  })

  it('keeps the branch name while nothing has changed against it', () => {
    const session = sessionView({ id: 's', branch: 'feat/auth' })
    const branch = buildInteriorHeader({ session }).meta.find(({ id }) => id === 'branch')
    expect(branch?.text).toBe('feat/auth')
  })

  it('drops elapsed for a running session, whose turn start is not observable', () => {
    const session = sessionView({ id: 's', lastActivityAt: NOW - 8 * MINUTE })
    const header = buildInteriorHeader({ session, nowMs: NOW })
    expect(header.meta.some(({ id }) => id === 'elapsed')).toBe(false)
  })

  it('spells a long rest in hours', () => {
    const session = sessionView({
      id: 's',
      lastActivityAt: NOW - 150 * MINUTE,
      facts: sessionFacts({ status: 'idle' }),
    })
    const header = buildInteriorHeader({ session, nowMs: NOW })
    expect(header.meta.find(({ id }) => id === 'elapsed')?.text).toBe('idle 2h')
  })
})

describe("the header's intent chip", () => {
  it('spells the intent chip in full when the title did not come from the ticket', () => {
    const header = buildInteriorHeader({
      session: sessionView({ id: 's', title: 'Auth refactor' }),
      link: link({ intent: { number: 42, title: 'Auth flow' } }),
    })
    expect(header.intent).toEqual({ number: 42, text: 'intent #42 Auth flow' })
  })

  it('collapses the intent chip so it never repeats a ticket-derived title', () => {
    const header = buildInteriorHeader({
      session: sessionView({ id: 's', title: 'Auth flow' }),
      link: link({ titleSource: 'ticket', intent: { number: 42, title: 'Auth flow' } }),
    })
    expect(header.intent).toEqual({ number: 42, text: '#42' })
  })

  it('drops the intent chip whole for a session Argo only observes', () => {
    const header = buildInteriorHeader({
      session: sessionView({ id: 's', posture: 'external' }),
      link: link({ intent: { number: 42, title: 'Auth flow' } }),
    })
    expect(header.intent).toBeNull()
    expect(header.external).toBe(true)
    expect(header.contextPercent).toBeNull()
  })

  it('treats an orphaned session as external — observation-only, so nothing to steer', () => {
    const header = buildInteriorHeader({ session: sessionView({ id: 's', posture: 'orphaned' }) })
    expect(header.external).toBe(true)
  })
})
