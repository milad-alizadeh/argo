import { describe, expect, test } from 'vitest'
import { SessionContractError } from '../../session-contract-error'
import type { Session } from '../../types'
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

describe('sameRosterRow', () => {
  const session = { id: 'session-1' } as Session
  const error = readFailure('test-archive-error', 'read failed')
  const otherError = readFailure('test-other-error', 'read failed again')

  test('holds a Session that arrived in a rebuilt row object', () => {
    expect(
      sameRosterRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session, archived: false },
      ),
    ).toBe(true)
  })

  test('parts a Session the read changed', () => {
    expect(
      sameRosterRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session: { ...session }, archived: false },
      ),
    ).toBe(false)
  })

  test('parts a Session that moved into the Archive', () => {
    expect(
      sameRosterRow(
        { kind: 'session', session, archived: false },
        { kind: 'session', session, archived: true },
      ),
    ).toBe(false)
  })

  test('holds two status rows of one kind', () => {
    expect(sameRosterRow({ kind: 'rosterSentinel' }, { kind: 'rosterSentinel' })).toBe(true)
  })

  test('parts two status rows of different kinds', () => {
    expect(sameRosterRow({ kind: 'rosterSentinel' }, { kind: 'rosterLoadingMore' })).toBe(false)
  })

  test('parts two Archive failures carrying different errors', () => {
    expect(
      sameRosterRow({ kind: 'archivedError', error }, { kind: 'archivedError', error: otherError }),
    ).toBe(false)
  })
})
