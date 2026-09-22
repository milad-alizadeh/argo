import { describe, expect, test } from 'vitest'
import { SessionContractError } from '@/domains/sessions/renderer/session-contract-error'
import type { Session } from '@/domains/sessions/renderer/types'
import { sameRosterRow } from './roster-rows'

function readFailure(requestId: string, message: string) {
  return new SessionContractError({
    version: 1,
    type: 'session.error',
    requestId,
    code: 'internal-error',
    message,
  })
}

describe('deciding whether a roster row is the same row across a rebuild', () => {
  const session = { id: 'session-1' } as Session
  const error = readFailure('test-archive-error', 'read failed')
  const otherError = readFailure('test-other-error', 'read failed again')

  test('reads a rebuilt row object carrying one Session as the same row', () => {
    expect(
      sameRosterRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session, archived: false },
      ),
    ).toBe(true)
  })

  test('reads a Session the read changed as a different row', () => {
    expect(
      sameRosterRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session: { ...session }, archived: false },
      ),
    ).toBe(false)
  })

  test('reads a Session that moved into the Archive as a different row', () => {
    expect(
      sameRosterRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session, archived: true },
      ),
    ).toBe(false)
  })

  test('reads two status rows of one kind as the same row', () => {
    expect(sameRosterRow({ kind: 'rosterSentinel' }, { kind: 'rosterSentinel' })).toBe(true)
  })

  test('reads two status rows of different kinds as different rows', () => {
    expect(sameRosterRow({ kind: 'rosterSentinel' }, { kind: 'rosterLoadingMore' })).toBe(false)
  })

  test('reads two Archive failures carrying different errors as different rows', () => {
    expect(
      sameRosterRow({ kind: 'archivedError', error }, { kind: 'archivedError', error: otherError }),
    ).toBe(false)
  })
})
