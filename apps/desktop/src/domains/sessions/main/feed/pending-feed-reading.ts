import path from 'node:path'
import type { Database } from '@/database/database'
import { type FeedReading, FeedRowProjector, feedReading } from '@/domains/sessions/api/feed'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { pendingSessionDraft } from '@/domains/sessions/api/pending-session'
import { type ComposerDraftValue, readComposerDraft } from '../database'

// The prompt as the Session's first Feed row, drawn by the same projection as a Harness's row.
function promptContent(draft: ComposerDraftValue): FeedContent {
  const images = draft.attachments.flatMap((attachment) =>
    attachment.kind === 'image' ? [{ kind: 'path' as const, path: attachment.path }] : [],
  )
  const files = draft.attachments.flatMap((attachment) =>
    attachment.kind === 'file'
      ? [{ label: path.basename(attachment.path), target: attachment.path }]
      : [],
  )
  return {
    kind: 'message',
    id: draft.id,
    role: 'user',
    text: draft.prompt,
    ...(images.length > 0 ? { images } : {}),
    ...(files.length > 0 ? { files } : {}),
  }
}

// A pending Session's Feed is the prompt it was sent; null for any other Session. A draft that is
// gone or moved on has no prompt to show, so its Feed stays loading.
export function pendingFeedReading(database: Database, sessionId: string): FeedReading | null {
  const pending = pendingSessionDraft(sessionId)
  if (pending === null) return null
  const draft = readComposerDraft(database, pending.draftId)
  const sent = draft?.revision === pending.revision ? draft : null
  const { entries } = new FeedRowProjector().project({
    history: sent === null ? [] : [promptContent(sent)],
    live: [],
  })
  return feedReading({
    sessionId,
    chainId: sessionId,
    state: sent === null ? 'loading' : 'ready',
    error: null,
    pendingPermissionId: null,
    liveStatus: null,
    entries,
    hasOlder: false,
    subagents: [],
  })
}
