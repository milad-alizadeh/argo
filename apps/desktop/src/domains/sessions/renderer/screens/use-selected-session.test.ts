import { describe, expect, test } from 'bun:test'
import { sessionRosterRow } from '@/domains/sessions/renderer/session-fixtures'
import { selectedSession } from './use-selected-session'

describe('selectedSession', () => {
  test('uses the searched row title for a selected Session', () => {
    const rosterSession = sessionRosterRow({
      id: 'session-1',
      title: { text: 'Roster title', source: 'first-prompt' },
    })
    const searchedSession = sessionRosterRow({
      id: 'session-1',
      title: { text: 'Search title', source: 'summarised' },
    })

    expect(selectedSession('session-1', [rosterSession], [searchedSession])).toMatchObject({
      title: { text: 'Search title', source: 'summarised' },
    })
  })
})
