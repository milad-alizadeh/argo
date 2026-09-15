import { expect, test } from 'bun:test'
import type { TurnMarkerEntry, TurnMarkerRow } from './turn-marker-state'
import {
  optimisticRowFor,
  runningTurnView,
  stageFor,
  turnEnded,
  turnMarkerView,
} from './turn-marker-state'

function entry(overrides: Partial<TurnMarkerEntry> = {}): TurnMarkerEntry {
  return { stage: 'live', since: null, startedAt: 1000, prompt: 'hello', ...overrides }
}

function row(overrides: Partial<TurnMarkerRow> = {}): TurnMarkerRow {
  return { turnStartedAt: null, status: 'running', ...overrides }
}

test('stageFor starts a draft identity', () => {
  expect(stageFor('draft', null)).toBe('starting')
})

test('stageFor resumes a session identity whose posture is not managed', () => {
  expect(stageFor('session', 'external')).toBe('resuming')
  expect(stageFor('session', null)).toBe('resuming')
})

test('stageFor reads live for a session identity already managed', () => {
  expect(stageFor('session', 'managed')).toBe('live')
})

test('turnMarkerView holds Starting until the real record catches up', () => {
  const e = entry({ stage: 'starting', since: null })
  expect(turnMarkerView(e, null)).toEqual({ phase: 'starting', startedAt: 1000 })
  expect(turnMarkerView(e, row({ turnStartedAt: null }))).toEqual({
    phase: 'starting',
    startedAt: 1000,
  })
})

test('turnMarkerView holds Resuming until the real record catches up', () => {
  const e = entry({ stage: 'resuming', since: null })
  expect(turnMarkerView(e, row({ turnStartedAt: null }))).toEqual({
    phase: 'resuming',
    startedAt: 1000,
  })
})

test('turnMarkerView reads Working once the real record catches up', () => {
  const e = entry({ stage: 'starting', since: null })
  expect(turnMarkerView(e, row({ turnStartedAt: '2026-01-01T00:00:00Z' }))).toEqual({
    phase: 'working',
    startedAt: 1000,
  })
})

test('turnMarkerView reads Working immediately for a live stage', () => {
  const e = entry({ stage: 'live', since: null })
  expect(turnMarkerView(e, row({ turnStartedAt: null }))).toEqual({
    phase: 'working',
    startedAt: 1000,
  })
})

test('runningTurnView times a Turn no Send opened from its own start', () => {
  const turnStartedAt = '2026-01-01T00:00:00Z'
  expect(runningTurnView(row({ turnStartedAt }))).toEqual({
    phase: 'working',
    startedAt: Date.parse(turnStartedAt),
  })
})

test('runningTurnView shows nothing for a Session that is not running', () => {
  expect(runningTurnView(row({ turnStartedAt: '2026-01-01T00:00:00Z', status: 'idle' }))).toBe(null)
  expect(runningTurnView(row({ turnStartedAt: null }))).toBe(null)
  expect(runningTurnView(null)).toBe(null)
})

test('optimisticRowFor shows the prompt until the record settles', () => {
  const e = entry({ since: null, prompt: 'do the thing' })
  const shown = optimisticRowFor(e, row({ turnStartedAt: null }))
  expect(shown).toEqual({
    shape: 'prose',
    id: 'optimistic-turn:1000',
    role: 'user',
    text: 'do the thing',
  })
})

test('optimisticRowFor retires once turnStartedAt moves off the entry’s since', () => {
  const e = entry({ since: null })
  expect(optimisticRowFor(e, row({ turnStartedAt: '2026-01-01T00:00:00Z' }))).toBeNull()
})

test('turnEnded is false before the record settles, even if status is not running', () => {
  const e = entry({ since: null })
  expect(turnEnded(e, row({ turnStartedAt: null, status: 'idle' as never }))).toBe(false)
})

test('turnEnded is false once settled while still running', () => {
  const e = entry({ since: null })
  expect(turnEnded(e, row({ turnStartedAt: '2026-01-01T00:00:00Z', status: 'running' }))).toBe(
    false,
  )
})

test('turnEnded is true once settled and the session has left running', () => {
  const e = entry({ since: null })
  expect(
    turnEnded(e, row({ turnStartedAt: '2026-01-01T00:00:00Z', status: 'idle' as never })),
  ).toBe(true)
})
