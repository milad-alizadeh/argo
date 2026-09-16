import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

function record(threadId: string, records: unknown[]) {
  const transcripts = process.env.ARGO_CODEX_TRANSCRIPTS
  if (transcripts === undefined) return
  const day = path.join(transcripts, '2026', '09', '14')
  mkdirSync(day, { recursive: true })
  const transcript = path.join(day, `rollout-2026-09-14T15-17-11-${threadId}.jsonl`)
  appendFileSync(transcript, `${records.map((item) => JSON.stringify(item)).join('\n')}\n`)
}

function meta(threadId: string) {
  return {
    timestamp: new Date().toISOString(),
    type: 'session_meta',
    payload: { id: threadId, cwd: process.cwd() },
  }
}

export function recordTurn(threadId: string, text: string) {
  record(threadId, [
    meta(threadId),
    {
      timestamp: new Date().toISOString(),
      type: 'event_msg',
      payload: { type: 'user_message', message: text },
    },
  ])
}

export function recordStalledTurn(threadId: string) {
  record(threadId, [meta(threadId)])
}
