import { mkdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'

// The file the `PreCompact` hook leaves when it sees a compaction start, written at `startedAt`.
export async function writeCompactionStart(starts: string, sessionId: string, startedAt: Date) {
  await mkdir(starts, { recursive: true })
  const start = path.join(starts, '4242.json')
  await writeFile(start, JSON.stringify({ session_id: sessionId, hook_event_name: 'PreCompact' }))
  await utimes(start, startedAt, startedAt)
}
