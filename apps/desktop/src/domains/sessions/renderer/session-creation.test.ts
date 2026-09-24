import { beforeEach, expect, test } from 'bun:test'

import {
  isOptimisticSessionId,
  newSessionTarget,
  readableSessionId,
  useSessionCreationStore,
} from './session-creation'

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

test('a new Session action targets the pending row', () => {
  const target = newSessionTarget('claude', '/argo')
  expect(target).toBe(useSessionCreationStore.getState().pending?.id)
})

test('repeated new Session actions target one pending row', () => {
  const first = newSessionTarget('claude', '/argo')
  expect(newSessionTarget('claude', '/argo')).toBe(first)
  expect(newSessionTarget('codex', '/other')).toBe(first)
})

test('a new Session action without an open Project creates no row', () => {
  expect(newSessionTarget('claude', null)).toBeNull()
  expect(useSessionCreationStore.getState().pending).toBeNull()
})

test('a fresh begin after the prior row cleared starts a new one', () => {
  const first = useSessionCreationStore.getState().begin('claude', '/argo')
  useSessionCreationStore.getState().failed(first.id)
  const second = useSessionCreationStore.getState().begin('claude', '/argo')
  expect(second.id).not.toBe(first.id)
})

test('gives each draft-row submission a command identity', () => {
  const created = useSessionCreationStore.getState().begin('claude', '/argo')
  const first = useSessionCreationStore.getState().startSubmission(created.id, 'hello')
  const second = useSessionCreationStore.getState().startSubmission(created.id, 'another prompt')
  expect(first).toEqual(expect.any(String))
  expect(second).toEqual(expect.any(String))
  expect(second).not.toBe(first)
})

test('an unknown id never claims a submission', () => {
  expect(useSessionCreationStore.getState().startSubmission('optimistic:missing', 'hello')).toBe(
    null,
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
