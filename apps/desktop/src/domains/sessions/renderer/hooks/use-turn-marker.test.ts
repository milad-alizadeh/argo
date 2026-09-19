import { expect, test } from 'bun:test'
import type { TurnMarkerEntries } from '@/domains/sessions/renderer/hooks/use-turn-marker'
import {
  beginEntry,
  clearEntry,
  rekeyEntry,
} from '@/domains/sessions/renderer/hooks/use-turn-marker'

const EMPTY: TurnMarkerEntries = new Map()

test('beginEntry adds an entry under its key', () => {
  const next = beginEntry(EMPTY, 'draft:1', {
    stage: 'starting',
    since: null,
    prompt: 'hi',
    images: [],
    startedAt: 500,
  })
  expect(next.get('draft:1')).toEqual({
    stage: 'starting',
    since: null,
    prompt: 'hi',
    images: [],
    startedAt: 500,
  })
})

test('rekeyEntry moves an entry from its draft key to the real Session id', () => {
  const started = beginEntry(EMPTY, 'draft:1', {
    stage: 'starting',
    since: null,
    prompt: 'hi',
    images: [],
    startedAt: 500,
  })
  const next = rekeyEntry(started, 'draft:1', 'session-1')
  expect(next.has('draft:1')).toBe(false)
  expect(next.get('session-1')).toEqual({
    stage: 'starting',
    since: null,
    prompt: 'hi',
    images: [],
    startedAt: 500,
  })
})

test('rekeyEntry is a no-op when the source key is absent', () => {
  expect(rekeyEntry(EMPTY, 'draft:1', 'session-1')).toBe(EMPTY)
})

test('clearEntry removes an entry by key', () => {
  const started = beginEntry(EMPTY, 'session-1', {
    stage: 'live',
    since: null,
    prompt: 'hi',
    images: [],
    startedAt: 500,
  })
  const next = clearEntry(started, 'session-1')
  expect(next.has('session-1')).toBe(false)
})

test('clearEntry is a no-op when the key is absent', () => {
  expect(clearEntry(EMPTY, 'session-1')).toBe(EMPTY)
})
