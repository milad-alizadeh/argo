// Shared fixtures for the reader.test.ts suite (#2025): temp roots and hand-written transcripts
// for the real Claude and Codex adapters, plus request builders and typed reply readers.
import assert from 'node:assert/strict'
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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

function codexDay(root: string) {
  return path.join(root, '2026', '09', '13')
}

function codexMessage(text: string, updatedAt: string, id = 'm') {
  return `${JSON.stringify({
    timestamp: updatedAt,
    type: 'event_msg',
    payload: {
      type: 'agent_message',
      item: { type: 'AgentMessage', id, content: [{ type: 'text', text }] },
    },
  })}\n`
}

export async function writeCodexTranscript({ root, sessionId, text, updatedAt }: TranscriptLine) {
  const day = codexDay(root)
  await mkdir(day, { recursive: true })
  await writeFile(
    path.join(day, `${sessionId}.jsonl`),
    `${JSON.stringify({
      timestamp: updatedAt,
      type: 'session_meta',
      payload: { id: sessionId },
    })}\n${codexMessage(text, updatedAt)}`,
  )
}

// Each appended record needs an id of its own, or the Feed reads two of them as one Message.
let appended = 0

function codexRecord({ root, sessionId, text, updatedAt }: TranscriptLine) {
  appended += 1
  return {
    file: path.join(codexDay(root), `${sessionId}.jsonl`),
    record: codexMessage(text, updatedAt, `m-${appended}`),
  }
}

// The CLI adding to a transcript the reader is already watching.
export async function appendCodexTranscript(line: TranscriptLine) {
  const { file, record } = codexRecord(line)
  await appendFile(file, record)
}

// The same append caught halfway: half the record and no closing newline, which is what a read
// racing the write sees. The returned function writes the rest of the same bytes.
export async function appendHalfCodexTranscript(line: TranscriptLine) {
  const { file, record } = codexRecord(line)
  const cut = Math.floor(record.length / 2)
  await appendFile(file, record.slice(0, cut))
  return () => appendFile(file, record.slice(cut))
}

// A whole line the CLI finished writing that is not a record: real corruption, not a torn read.
export async function appendGarbledCodexLine({
  root,
  sessionId,
}: Pick<TranscriptLine, 'root' | 'sessionId'>) {
  await appendFile(path.join(codexDay(root), `${sessionId}.jsonl`), '{"type": garbled\n')
}

export function listing(requestId = 'list-1') {
  return { version: 1, type: 'session.list', requestId } as const
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
