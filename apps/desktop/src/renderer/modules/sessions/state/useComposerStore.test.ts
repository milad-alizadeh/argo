import { expect, test } from 'bun:test'

import { useComposerStore } from './useComposerStore'

// A draft is keyed by the composer's identity, so it survives under a draft key even though no
// Session exists yet, and is invisible under any Session id.
test('a draft survives before a Session exists, keyed by its own identity', () => {
  useComposerStore.getState().setDraft('new:project-1', 'still writing this')
  expect(useComposerStore.getState().drafts['new:project-1']).toBe('still writing this')
  expect(useComposerStore.getState().drafts['session-1']).toBeUndefined()
  useComposerStore.getState().setDraft('new:project-1', '')
})
