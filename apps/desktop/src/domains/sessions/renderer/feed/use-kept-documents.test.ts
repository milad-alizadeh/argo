import { describe, expect, test } from 'vitest'
import { useKeptDocuments } from '@/domains/sessions/renderer/feed/use-kept-documents'

describe('keeping only the selected feed document mounted', () => {
  test('exposes only the selected feed document', () => {
    const feed = { sessionId: 'session-a', revision: '1', rows: [] } as never

    expect(useKeptDocuments(feed, 'session-a').ordered).toEqual([['session-a', feed]])
    expect(useKeptDocuments(feed, 'session-b')).toEqual({ current: null, ordered: [] })
  })
})
