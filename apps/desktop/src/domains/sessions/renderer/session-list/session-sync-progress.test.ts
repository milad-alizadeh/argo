import { expect, test } from 'bun:test'
import type { RouterOutputs } from '@/platform/renderer/trpc-client'
import { sessionSyncProgress } from './session-sync-progress'

type SessionSyncStatus = Extract<RouterOutputs['sessionSyncStatus'], { type: 'status' }>['status']

function status(overrides: Partial<SessionSyncStatus>): SessionSyncStatus {
  return {
    phase: 'saving',
    processed: 0,
    total: 4,
    skipped: 0,
    lastSuccessfulSyncAt: null,
    failure: null,
    ...overrides,
  }
}

test('leaves progress indeterminate while the worker fetches or has no total', () => {
  expect(sessionSyncProgress(status({ phase: 'fetching', total: null }))).toBeNull()
  expect(sessionSyncProgress(status({ total: null }))).toBeNull()
})

test('reports the processed share of the known total', () => {
  expect(sessionSyncProgress(status({ processed: 1, total: 4 }))).toBe(25)
})

test('treats a known empty result as complete progress', () => {
  expect(sessionSyncProgress(status({ total: 0 }))).toBe(100)
})
