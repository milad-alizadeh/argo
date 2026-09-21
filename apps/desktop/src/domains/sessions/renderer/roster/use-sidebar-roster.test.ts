import { expect, test } from 'bun:test'
import { rosterTitledSearchResults } from '@/domains/sessions/renderer/roster/use-sidebar-roster'
import { sessionRosterRow } from '@/domains/sessions/renderer/session-fixtures'

test('search result uses the active roster title for the same Session', () => {
  const roster = sessionRosterRow({
    id: 'session',
    title: { text: 'Current Session title', source: 'summarised' },
  })
  const searchResult = sessionRosterRow({
    id: 'session',
    title: { text: 'First prompt line', source: 'first-prompt' },
  })

  expect(rosterTitledSearchResults([searchResult], [roster])).toEqual([roster])
})
