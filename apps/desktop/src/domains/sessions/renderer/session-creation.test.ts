import { beforeEach, expect, test } from 'bun:test'

import type { SessionRosterRow } from '@/domains/sessions/contract/model'
import {
  isOptimisticSessionId,
  mergeOptimisticRow,
  newSessionTarget,
  optimisticSessionRow,
  readableSessionId,
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

test('names an optimistic id by its reserved prefix', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  expect(isOptimisticSessionId(created.id)).toBe(true)
  expect(isOptimisticSessionId('session-1')).toBe(false)
})

test('a second begin while one is pending returns the same row, not a second one', () => {
  const first = useSessionCreationStore.getState().begin('claude', '/argo')
  const second = useSessionCreationStore.getState().begin('codex', '/other')
  expect(second).toEqual(first)
})

test('a fresh begin after the prior row cleared starts a new one', () => {
  const first = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().failed(first.id)
  const second = useSessionCreationStore.getState().begin('claude', '/argo')
  expect(second.id).not.toBe(first.id)
})

test('claims the one submission for a draft row', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  expect(useSessionCreationStore.getState().startSubmission(created.id, 'hello')).toBe(true)
  // A rapid second Enter/"+" finds it already submitting and no-ops (#2109).
  expect(useSessionCreationStore.getState().startSubmission(created.id, 'hello')).toBe(false)
})

test('an unknown id never claims a submission', () => {
  expect(useSessionCreationStore.getState().startSubmission('optimistic:missing', 'hello')).toBe(
    false,
  )
})

test('resolving moves the row to the real Session id, still pending confirmation', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().startSubmission(created.id, 'hello')
  useSessionCreationStore.getState().resolved(created.id, 'session-real')
  expect(useSessionCreationStore.getState().pending).toEqual({
    stage: 'reconciling',
    id: 'session-real',
    harness: 'claude',
    cwd: '/argo',
    prompt: 'hello',
  })
})

test('the row is named by the first line of the prompt sent, until the Harness names it', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  expect(optimisticSessionRow(created).title).toBeNull()
  useSessionCreationStore
    .getState()
    .startSubmission(created.id, '\n  Fix the login bug \nthen test')
  const submitted = useSessionCreationStore.getState().pending
  expect(submitted && optimisticSessionRow(submitted).title).toEqual({
    text: 'Fix the login bug',
    source: 'first-prompt',
  })
  useSessionCreationStore.getState().resolved(created.id, 'session-real')
  const reconciling = useSessionCreationStore.getState().pending
  expect(reconciling && optimisticSessionRow(reconciling).title?.text).toBe('Fix the login bug')
})

test('a failure clears the row rather than leaving a starting ghost', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().failed(created.id)
  expect(useSessionCreationStore.getState().pending).toBeNull()
})

test('confirming the real Session clears the synthetic row', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().resolved(created.id, 'session-real')
  useSessionCreationStore.getState().confirmed('session-real')
  expect(useSessionCreationStore.getState().pending).toBeNull()
})

test('confirming an unrelated id leaves a reconciling row untouched', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().resolved(created.id, 'session-real')
  useSessionCreationStore.getState().confirmed('session-other')
  expect(useSessionCreationStore.getState().pending?.id).toBe('session-real')
})

test('abandoning a draft row clears it', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().abandon(created.id)
  expect(useSessionCreationStore.getState().pending).toBeNull()
})

test('abandoning never clears a row already reconciling', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().resolved(created.id, 'session-real')
  useSessionCreationStore.getState().abandon('session-real')
  expect(useSessionCreationStore.getState().pending?.id).toBe('session-real')
})

test('a real Session id is readable, an optimistic one is not', () => {
  expect(readableSessionId('session-1')).toBe('session-1')
  expect(readableSessionId('optimistic:1')).toBeNull()
  expect(readableSessionId(null)).toBeNull()
})

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
