import { beforeEach, expect, test } from 'bun:test'

import type { SessionRosterRow } from '@/domains/sessions/renderer/model/models'
import {
  mergeOptimisticRow,
  newSessionTarget,
  optimisticSessionRow,
  useSessionCreationStore,
} from './session-creation'

beforeEach(() => {
  useSessionCreationStore.setState({ pending: null })
})

function realSessionRow(id: string): SessionRosterRow {
  return {
    ...optimisticSessionRow({
      stage: 'draft',
      id,
      harness: 'claude',
      cwd: '/argo',
      submitting: false,
      prompt: null,
    }),
    status: 'running',
  }
}

// The dedup and reconciliation ACs of #2109: no duplicate entry once the real Session shows up,
// and the merge is a no-op with nothing pending.
test('merges no row onto a real Roster read when nothing is pending', () => {
  const rows = [realSessionRow('session-1')]
  expect(mergeOptimisticRow(rows, null)).toBe(rows)
})

test('puts the optimistic row first, once, above the real Roster', () => {
  const real = [realSessionRow('session-1')]
  const pending = {
    stage: 'draft',
    id: 'optimistic:1',
    harness: 'codex',
    cwd: '/argo',
    submitting: false,
    prompt: null,
  } as const
  const merged = mergeOptimisticRow(real, pending)
  expect(merged.map((row) => row.id)).toEqual(['optimistic:1', 'session-1'])
})

test('never duplicates the row once the real Session appears under the reconciled id', () => {
  const real = [realSessionRow('session-1'), realSessionRow('session-new')]
  const pending = {
    stage: 'reconciling',
    id: 'session-new',
    harness: 'codex',
    cwd: '/argo',
    prompt: null,
  } as const
  expect(mergeOptimisticRow(real, pending)).toBe(real)
})

test('a fresh "+" with a Project open begins a new pending row and targets it', () => {
  const target = newSessionTarget('claude', '/argo')
  expect(target).toBe(useSessionCreationStore.getState().pending?.id)
})

// One user action produces at most one new Session, even under N rapid "+" clicks (#2109).
test('a repeat "+" while one is already pending refocuses it instead of starting a second one', () => {
  const first = newSessionTarget('claude', '/argo')
  const second = newSessionTarget('claude', '/argo')
  const third = newSessionTarget('codex', '/other')
  expect(second).toBe(first)
  expect(third).toBe(first)
})

test('a "+" with no Project open targets nothing, and begins no row', () => {
  expect(newSessionTarget('claude', null)).toBeNull()
  expect(useSessionCreationStore.getState().pending).toBeNull()
})

test('the Roster row for a pending Session is a fresh, untouched Session on the existing starting status', () => {
  const row = optimisticSessionRow({
    stage: 'draft',
    id: 'optimistic:1',
    harness: 'codex',
    cwd: '/argo',
    submitting: false,
    prompt: null,
  })
  expect(row.id).toBe('optimistic:1')
  expect(row.harness).toBe('codex')
  expect(row.cwd).toBe('/argo')
  expect(row.status).toBe('starting')
  expect(row.title).toBeNull()
  expect(row.subagents).toEqual([])
  expect(row.shell).toEqual([])
})
