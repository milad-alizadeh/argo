import { describe, expect, it } from 'vitest'
import { createManagedSessions } from './managed'

const CWD = '/Users/x/tree'
const BEFORE = Date.parse('2026-07-20T13:00:00.000Z')
const DURING = Date.parse('2026-07-20T14:00:00.000Z')

describe('managed sessions', () => {
  it('grades a Session that began inside a live claim as managed, and one outside it external', () => {
    const managed = createManagedSessions(() => BEFORE)
    managed.claim(CWD)

    expect(managed.postureFor(CWD, DURING)).toBe('managed')
    expect(managed.postureFor(CWD, BEFORE - 1)).toBe('external')
    expect(managed.postureFor('/somewhere/else', DURING)).toBe('external')
  })
})

describe('managed sessions — which agent a Session steers', () => {
  it('hands a bound Session the claim whose agent PTY it steers', () => {
    const managed = createManagedSessions(() => BEFORE)
    const claim = managed.claim(CWD)

    managed.bind('session-a', CWD, DURING)

    expect(managed.ownerOf('session-a')).toBe(claim)
  })

  it('binds each Session to its OWN claim, so two never steer each other', () => {
    let clock = BEFORE
    const managed = createManagedSessions(() => clock)
    const first = managed.claim(CWD)
    const second = managed.claim('/Users/x/other')
    clock = DURING

    managed.bind('session-a', CWD, DURING)
    managed.bind('session-b', '/Users/x/other', DURING)

    expect(managed.ownerOf('session-a')).toBe(first)
    expect(managed.ownerOf('session-b')).toBe(second)
    expect(first).not.toBe(second)
  })

  it('binds two Sessions spawned in the SAME folder to their own agents', () => {
    // ⌘N twice in one project: both claims are open on one cwd, and the first one's window never
    // closes — so a first-match lookup would hand both Docks the first agent.
    let clock = BEFORE
    const managed = createManagedSessions(() => clock)
    const first = managed.claim(CWD)
    clock = DURING
    const second = managed.claim(CWD)

    managed.bind('session-a', CWD, BEFORE + 1)
    managed.bind('session-b', CWD, DURING + 1)

    expect(managed.ownerOf('session-a')).toBe(first)
    expect(managed.ownerOf('session-b')).toBe(second)
  })

  it('steers the agent Argo started FOR a Session its claims do not cover', () => {
    const managed = createManagedSessions(() => BEFORE)
    const claim = managed.claim('/elsewhere')

    managed.adopt('external-one', claim)
    // The observer keeps publishing; a Session no claim covers must keep the agent it was given.
    managed.bind('external-one', '/Users/x/tree', DURING)

    expect(managed.ownerOf('external-one')).toBe(claim)
    expect(managed.postureFor('/Users/x/tree', DURING)).toBe('external')
  })

  it('owns nothing for a Session no claim covers', () => {
    const managed = createManagedSessions(() => BEFORE)
    managed.claim(CWD)

    managed.bind('external-one', '/elsewhere', DURING)
    managed.bind('no-cwd', null, DURING)

    expect(managed.ownerOf('external-one')).toBeNull()
    expect(managed.ownerOf('no-cwd')).toBeNull()
    expect(managed.ownerOf('never-observed')).toBeNull()
  })

  it('drops ownership once the PTY exits — an orphaned Session has nothing to steer', () => {
    let clock = BEFORE
    const managed = createManagedSessions(() => clock)
    const claim = managed.claim(CWD)
    clock = Date.parse('2026-07-20T15:00:00.000Z')
    managed.bind('session-a', CWD, DURING)

    managed.release(claim)

    expect(managed.postureFor(CWD, DURING)).toBe('orphaned')
    expect(managed.ownerOf('session-a')).toBeNull()
  })
})
