import { expect, test } from 'vitest'
import { pendingSessionId } from '@/domains/sessions/api/pending-session'
import {
  database,
  historyReads,
  observe,
  registerFeedDatabase,
  sessionId,
} from '@/mocks/sessions/session-feed-harness'
import { deleteComposerDraft, insertComposerDraft, updateComposerDraft } from '../database'

registerFeedDatabase()

const TURN_CONFIGURATION = { model: 'opus', effort: 'high', mode: 'default' }

function sentDraft(prompt: string) {
  return insertComposerDraft(database, {
    id: 'draft-1',
    target: { type: 'session', sessionId },
    prompt,
    attachments: [
      { path: '/work/screen.png', kind: 'image' },
      { path: '/work/notes.md', kind: 'file' },
    ],
    ticketContext: [],
    turnConfiguration: TURN_CONFIGURATION,
  })
}

test('a pending Session reads as the prompt it was sent, with no history read', async () => {
  const draft = sentDraft('Start the release notes')
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory }, pendingSessionId(draft))
  expect(feed.latest()).toMatchObject({ state: 'ready', error: null })
  expect(feed.latest()?.entries.map(({ row }) => row)).toEqual([
    {
      shape: 'prose',
      id: draft.id,
      role: 'user',
      text: 'Start the release notes',
      images: ['argo-attachment://local/work/screen.png'],
      files: ['/work/notes.md'],
    },
  ])
  expect(history.pending).toHaveLength(0)
  feed.subscription.unsubscribe()
})

test('a pending Session whose draft moved on or is gone has no prompt to draw', async () => {
  const draft = sentDraft('First words')
  const pending = pendingSessionId(draft)
  updateComposerDraft(database, {
    id: draft.id,
    expectedRevision: draft.revision,
    target: draft.target,
    prompt: 'Second words',
    attachments: [],
    ticketContext: [],
    turnConfiguration: TURN_CONFIGURATION,
  })
  const moved = await observe({ readHistory: historyReads().readHistory }, pending)
  expect(moved.latest()).toMatchObject({ state: 'loading', entries: [] })
  moved.subscription.unsubscribe()
  deleteComposerDraft(database, draft.id, draft.revision + 1)
  const gone = await observe({ readHistory: historyReads().readHistory }, pending)
  expect(gone.latest()).toMatchObject({ state: 'loading', entries: [] })
  gone.subscription.unsubscribe()
})
