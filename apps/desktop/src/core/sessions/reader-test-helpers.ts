// Shared fixtures for the reader.test.ts suite (#2025): temp roots and hand-written transcripts
// for the real Claude and Codex adapters, plus request builders and typed reply readers.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sessionFeedReplySchema, sessionListReplySchema } from './contract'
import type { createSessionReader } from './reader'

export async function tempRoot(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-reader-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  return root
}

type TranscriptLine = { root: string; sessionId: string; text: string; updatedAt: string }

export async function writeClaudeTranscript({ root, sessionId, text, updatedAt }: TranscriptLine) {
  const project = path.join(root, 'project-one')
  await mkdir(project, { recursive: true })
  await writeFile(
    path.join(project, `${sessionId}.jsonl`),
    `${JSON.stringify({
      type: 'assistant',
      uuid: `${sessionId}-a`,
      timestamp: updatedAt,
      message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text }] },
    })}\n`,
  )
}

export async function writeCodexTranscript({ root, sessionId, text, updatedAt }: TranscriptLine) {
  const day = path.join(root, '2026', '09', '13')
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `${sessionId}.jsonl`),
    `${JSON.stringify({
      timestamp: updatedAt,
      type: 'session_meta',
      payload: { id: sessionId },
    })}\n${JSON.stringify({
      timestamp: updatedAt,
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        item: { type: 'AgentMessage', id: 'm', content: [{ type: 'text', text }] },
      },
    })}\n`,
  )
}

export function listing(requestId = 'list-1') {
  return { version: 1, type: 'session.list', requestId }
}

export function feedRequest(
  sessionId: string,
  requestId = 'feed-1',
  revision: string | null = null,
) {
  return { version: 1, type: 'session.feed', requestId, sessionId, revision }
}

export async function listed(reader: ReturnType<typeof createSessionReader>, requestId?: string) {
  const reply = sessionListReplySchema.parse(await reader.listSessions(listing(requestId)))
  assert.equal(reply.type, 'session.listed')
  return reply.type === 'session.listed' ? reply : null
}

export async function fed(
  reader: ReturnType<typeof createSessionReader>,
  request: ReturnType<typeof feedRequest>,
) {
  return sessionFeedReplySchema.parse(await reader.readSessionFeed(request))
}
