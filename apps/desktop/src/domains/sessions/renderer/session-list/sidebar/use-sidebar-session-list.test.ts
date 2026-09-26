import { expect, test } from 'bun:test'
import { sessionRow } from '../../session-fixtures'
import { sessionListTitledSearchResults } from './use-sidebar-session-list'

test('search result uses the active Session list title for the same Session', () => {
  const sessionList = sessionRow({
    id: 'session',
    title: { text: 'Current Session title', source: 'summarised' },
  })
  const searchResult = sessionRow({
    id: 'session',
    title: { text: 'First prompt line', source: 'first-prompt' },
  })

  expect(sessionListTitledSearchResults([searchResult], [sessionList])).toEqual([sessionList])
})
