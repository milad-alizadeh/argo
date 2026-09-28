import { expect, test } from 'vitest'
import { shouldLoadComposerDraft } from './composer-draft-load'

test('waits for the fresh draft when a cached owner is refetching', () => {
  expect(
    shouldLoadComposerDraft({
      owner: 'project:project-1',
      loadedOwner: 'session:session-1',
      isFetching: true,
      isError: false,
    }),
  ).toBe(false)
})

test('loads the refreshed draft after the owner query finishes', () => {
  expect(
    shouldLoadComposerDraft({
      owner: 'project:project-1',
      loadedOwner: 'session:session-1',
      isFetching: false,
      isError: false,
    }),
  ).toBe(true)
})

test('does not load a cached draft after its owner refresh fails', () => {
  expect(
    shouldLoadComposerDraft({
      owner: 'project:project-1',
      loadedOwner: 'session:session-1',
      isFetching: false,
      isError: true,
    }),
  ).toBe(false)
})

test('keeps a cached draft available when its refresh fails', () => {
  expect(
    shouldLoadComposerDraft({
      owner: 'project:project-1',
      loadedOwner: null,
      isFetching: false,
      isError: true,
      hasData: true,
    }),
  ).toBe(true)
})
