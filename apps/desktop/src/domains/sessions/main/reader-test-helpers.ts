import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  sessionFeedReplySchema,
  sessionListReplySchema,
} from '@/domains/sessions/contract/contract'
import { mergeAppendedFeed } from '@/domains/sessions/contract/feed-contract'
import type { createSessionReader } from './reader'

export {
  appendCodexRecord,
  appendCodexTranscript,
  appendGarbledCodexLine,
  appendHalfCodexTranscript,
  writeClaudeTranscript,
  writeCodexTranscript,
} from './reader-test-transcripts'

export async function tempRoot(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-reader-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

export function listing(
  requestId = 'list-1',
  options?: { cursor?: string | null; projectRoot?: string | null },
) {
  return {
    version: 1,
    type: 'session.list',
    requestId,
    projectRoot: options?.projectRoot ?? null,
    cursor: options?.cursor,
  } as const
}

export function feedRequest(
  sessionId: string,
  requestId = 'feed-1',
  revision: string | null = null,
) {
  return {
    version: 1,
    type: 'session.feed',
    requestId,
    sessionId,
    delegationId: null,
    revision,
  } as const
}

export async function listed(
  reader: ReturnType<typeof createSessionReader>,
  requestId?: string,
  options?: { cursor?: string | null; projectRoot?: string | null },
) {
  const reply = sessionListReplySchema.parse(await reader.listSessions(listing(requestId, options)))
  assert.equal(reply.type, 'session.listed')
  return reply.type === 'session.listed' ? reply : null
}

export async function fed(
  reader: ReturnType<typeof createSessionReader>,
  request: ReturnType<typeof feedRequest>,
) {
  return sessionFeedReplySchema.parse(await reader.readSessionFeed(request))
}

export function rowsOf(
  reply: Awaited<ReturnType<typeof fed>>,
  previous?: Awaited<ReturnType<typeof fed>>,
) {
  if (reply.type === 'session.feed.read') return reply.rows
  if (reply.type !== 'session.feed.appended') return assert.fail(`unexpected reply: ${reply.type}`)
  const cached = previous?.type === 'session.feed.read' ? previous : null
  return mergeAppendedFeed(cached, reply).rows
}
