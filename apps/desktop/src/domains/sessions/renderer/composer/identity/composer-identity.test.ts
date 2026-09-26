import { expect, test } from 'bun:test'

import { composerIdentityKey, composerIdentityOf } from './composer-identity'

test('reads no selected Session as a draft scoped to the open Project', () => {
  expect(composerIdentityOf(null, 'project-1')).toEqual({
    kind: 'draft',
    projectId: 'project-1',
  })
})

test('reads a draft with no Project open as scoped to nothing', () => {
  expect(composerIdentityOf(null, null)).toEqual({ kind: 'draft', projectId: null })
})

test('reads a selected Session id as session identity, Project ignored', () => {
  expect(composerIdentityOf('session-1', 'project-1')).toEqual({
    kind: 'session',
    sessionId: 'session-1',
  })
})

test('keys a session identity by its Session id', () => {
  expect(composerIdentityKey({ kind: 'session', sessionId: 'session-1' })).toBe('session-1')
})

test('keys a draft identity by its Project, and by a fixed word with none', () => {
  expect(composerIdentityKey({ kind: 'draft', projectId: 'project-1' })).toBe('new:project-1')
  expect(composerIdentityKey({ kind: 'draft', projectId: null })).toBe('new:unselected')
})
