import { beforeEach, expect, test } from 'bun:test'

import {
  isOptimisticSessionId,
  optimisticSessionRow,
  readableSessionId,
  useSessionCreationStore,
} from '@/domains/sessions/renderer/session-creation'

beforeEach(() => {
  useSessionCreationStore.setState({ pending: null })
})

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
    cli: 'claude',
    cwd: '/argo',
    prompt: 'hello',
  })
})

test('the row is named by the first line of the prompt sent, until the CLI names it', () => {
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
