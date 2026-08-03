import { sessionFacts, sessionView } from '@shared'
import { describe, expect, it } from 'vitest'
import { aRoot, aTurn, aUsage } from './__fixtures__/runtimeTree'
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

  it('orders the meta line mode · branch · elapsed', () => {
    const session = sessionView({
      id: 's',
      model: 'claude-opus-5',
      branch: 'feat/auth',
      lastActivityAt: NOW - 8 * MINUTE,
      facts: sessionFacts({ status: 'idle', dirty: 3, unpushed: 2 }),
    })
    const header = buildInteriorHeader({ session, link: link({ mode: 'Plan' }), nowMs: NOW })
    expect(header.meta.map(({ id }) => id)).toEqual(['mode', 'branch', 'elapsed'])
    expect(textOf(header.meta)).toEqual(['Plan', 'feat/auth', 'idle 8 minutes'])
  })

  // What the session has COST, which is every token it was observed to spend — not the ring's
  // separate question of what currently sits in the window.
  it('sums the whole observed token spend, compacted', () => {
    const session = sessionView({
      id: 's',
      agents: [
        aRoot({
          turns: [
            aTurn({
              id: 't',
              usage: aUsage({ inputTokens: 12_000, outputTokens: 3_000, cacheReadTokens: 33_000 }),
            }),
          ],
        }),
      ],
    })
    const spend = buildInteriorHeader({ session }).meta.find(({ id }) => id === 'tokens')
    expect(spend?.text).toBe('48K tokens')
  })

  it('claims no spend where the record carried no usage at all', () => {
    const session = sessionView({ id: 's', agents: [aRoot({ turns: [aTurn({ id: 't' })] })] })
    const header = buildInteriorHeader({ session })
    expect(header.meta.some(({ id }) => id === 'tokens')).toBe(false)
  })
})

// The deltas are what is worth the width here, but they are what changed against a NAME: a session
// whose branch the header will not say is a session you cannot place. They travel as numbers, so the
// notation stays the View's.
describe("the header's branch segment", () => {
  it('keeps the branch name AND the counts of what changed against it', () => {
    const session = sessionView({
      id: 's',
      branch: 'feat/auth',
      facts: sessionFacts({ dirty: 3, unpushed: 2 }),
    })
    const branch = buildInteriorHeader({ session }).meta.find((one) => one.id === 'branch')
    expect(branch).toMatchObject({ text: 'feat/auth', dirty: 3, unpushed: 2 })
  })

  it('drops the branch segment whole where there is no branch — deltas belong to one', () => {
    const session = sessionView({ id: 's', branch: null, facts: sessionFacts({ dirty: 3 }) })
    const header = buildInteriorHeader({ session })
    expect(header.meta.some(({ id }) => id === 'branch')).toBe(false)
  })

  it('keeps the branch name while nothing has changed against it', () => {
    const session = sessionView({ id: 's', branch: 'feat/auth' })
    const branch = buildInteriorHeader({ session }).meta.find(({ id }) => id === 'branch')
    expect(branch?.text).toBe('feat/auth')
  })
})

describe("the header's other meta segments", () => {
  // The band sheds every fact the roster rail already carries. The status survives as the dot, so
  // the state is still told — once, in the channel that costs no width.
  it('sheds the status word and the model, and keeps the status as a dot', () => {
    const session = sessionView({
      id: 's',
      model: 'claude-opus-5',
      facts: sessionFacts({ status: 'idle' }),
    })
    const header = buildInteriorHeader({ session })
    expect(textOf(header.meta)).not.toContain('idle')
    expect(textOf(header.meta)).not.toContain('claude-opus-5')
    expect(header.status.tone).toBeDefined()
  })

  it('says `unknown` for the mode rather than defaulting it', () => {
    const header = buildInteriorHeader({ session: sessionView({ id: 's' }) })
    const spoken = new Map(header.meta.map(({ id, text }) => [id, text]))
    expect(spoken.get('mode')).toBe('unknown')
  })

  it('drops elapsed for a running session, whose turn start is not observable', () => {
    const session = sessionView({ id: 's', lastActivityAt: NOW - 8 * MINUTE })
    const header = buildInteriorHeader({ session, nowMs: NOW })
    expect(header.meta.some(({ id }) => id === 'elapsed')).toBe(false)
  })

  // date-fns picks the unit and ROUNDS to it (150 minutes is nearer 3 hours than 2), where the old
  // hand-rolled formatter floored. Rounding is the better reading of a rest.
  it('spells a long rest in hours', () => {
    const session = sessionView({
      id: 's',
      lastActivityAt: NOW - 150 * MINUTE,
      facts: sessionFacts({ status: 'idle' }),
    })
    const header = buildInteriorHeader({ session, nowMs: NOW })
    expect(header.meta.find(({ id }) => id === 'elapsed')?.text).toBe('idle 3 hours')
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
