import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

export function recordTurn(threadId: string, text: string) {
  const transcripts = process.env.ARGO_CODEX_TRANSCRIPTS
  if (transcripts === undefined) return
  const day = path.join(transcripts, '2026', '09', '14')
  mkdirSync(day, { recursive: true })
  const transcript = path.join(day, `rollout-2026-09-14T15-17-11-${threadId}.jsonl`)
  appendFileSync(
    transcript,
    `${[
      {
        timestamp: new Date().toISOString(),
        type: 'session_meta',
        payload: { id: threadId, cwd: process.cwd() },
      },
      {
        timestamp: new Date().toISOString(),
        type: 'event_msg',
        payload: { type: 'user_message', message: text },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n')}\n`,
  )
}
