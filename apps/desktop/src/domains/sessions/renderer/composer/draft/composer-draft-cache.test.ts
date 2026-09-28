import { expect, test } from 'bun:test'
import { QueryClient } from '@tanstack/react-query'
import { trpc } from '@/platform/renderer/trpc-client'
import {
  cachedComposerDraft,
  forgetComposerDraft,
  rememberComposerDraft,
} from './composer-draft-cache'

function draft(sessionId: string, prompt: string, revision = 0) {
  return {
    id: `draft-${sessionId}`,
    target: { type: 'session' as const, sessionId },
    prompt,
    attachments: [],
    ticketContext: [],
    turnConfiguration: { model: 'opus', effort: 'high', mode: 'default' },
    revision,
    createdAt: 0,
    updatedAt: revision,
  }
}

test('keeps each owner to the draft saved for it', () => {
  const queryClient = new QueryClient()
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Saved for A.'))
  rememberComposerDraft(queryClient, 'session:b', draft('b', 'Saved for B.'))
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Saved again for A.', 1))
  expect(cachedComposerDraft(queryClient, 'session:a')?.prompt).toBe('Saved again for A.')
  expect(cachedComposerDraft(queryClient, 'session:b')?.prompt).toBe('Saved for B.')
  expect(cachedComposerDraft(queryClient, 'session:c')).toBeUndefined()
})

test('never lets a late read of an older revision replace a later save', () => {
  const queryClient = new QueryClient()
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Saved second.', 2))
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Read before the save.', 1))
  expect(cachedComposerDraft(queryClient, 'session:a')?.prompt).toBe('Saved second.')
})

test('takes a recreated draft even though its revision starts again', () => {
  const queryClient = new QueryClient()
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Old draft.', 4))
  rememberComposerDraft(queryClient, 'session:a', {
    ...draft('a', 'Recreated draft.'),
    id: 'draft-a-recreated',
  })
  expect(cachedComposerDraft(queryClient, 'session:a')?.prompt).toBe('Recreated draft.')
})

test('forgets a sent draft, but not one saved after the Send', () => {
  const queryClient = new QueryClient()
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Saved after the Send.', 3))
  forgetComposerDraft(queryClient, 'session:a', { id: 'draft-a', revision: 2 })
  expect(cachedComposerDraft(queryClient, 'session:a')?.prompt).toBe('Saved after the Send.')
  forgetComposerDraft(queryClient, 'session:a', { id: 'draft-a', revision: 3 })
  expect(cachedComposerDraft(queryClient, 'session:a')).toBeUndefined()
})

test('is cleared with the draft reads, so a reload reads the durable store again', () => {
  const queryClient = new QueryClient()
  rememberComposerDraft(queryClient, 'session:a', draft('a', 'Saved for A.'))
  queryClient.removeQueries({ queryKey: trpc.composerDraftRead.pathKey() })
  expect(cachedComposerDraft(queryClient, 'session:a')).toBeUndefined()
})
