import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSessionReader } from '@/domains/sessions/main/observation/reader'
import type { LiveMessage } from '../drive/channel/live-messages'
import { claudeSessionSource } from '../sessions/discovery/read-sessions'

const SESSION = 'c3b0f6a2-5d7e-4f7a-9d61-2f1f3c1d8e10'

export type Row = { id: string; shape: string; role?: string; text?: string }

// Records in the shapes claude 2.1.270 writes: one record per content block.
export const records = {
  prompt: (uuid: string, text: string) => ({
    type: 'user',
    uuid,
    message: { role: 'user', content: text },
  }),
  text: (uuid: string, text: string) => ({
    type: 'assistant',
    uuid,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  }),
  read: (uuid: string) => ({
    type: 'assistant',
    uuid,
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'toolu-read', name: 'Read', input: { file_path: 'a' } }],
    },
  }),
  result: (uuid: string) => ({
    type: 'user',
    uuid,
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu-read', content: 'Mallards.' }],
    },
  }),
}

export async function transcript(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-live-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'project'))
  const file = path.join(root, 'project', `${SESSION}.jsonl`)
  await writeFile(file, '')
  let written = 0
  return {
    root,
    // A later mtime than the last write, so the reader's stamp sees every append.
    async append(...lines: Record<string, unknown>[]) {
      const stamped = lines.map((line) => ({ ...line, sessionId: SESSION, timestamp: stamp() }))
      await appendFile(file, stamped.map((line) => `${JSON.stringify(line)}\n`).join(''))
      written += 1
      const ahead = new Date(Date.now() + written * 2000)
      await utimes(file, ahead, ahead)
    },
  }
}

let clock = 0
function stamp() {
  clock += 1
  return new Date(Date.UTC(2026, 8, 13, 15, 0, clock)).toISOString()
}

export function feedOf(live: () => LiveMessage[], root: string) {
  const reader = createSessionReader([
    claudeSessionSource({ transcripts: root, liveMessages: () => live() }),
  ])
  return async (revision: string | null = null) => {
    const reply = (await reader.readSessionFeed({
      version: 1,
      type: 'session.feed',
      requestId: 'feed-1',
      sessionId: SESSION,
      subagentId: null,
      revision,
    })) as { type: string; revision: string; rows?: Row[] }
    return reply
  }
}

export const said = (rows: Row[] | undefined) =>
  (rows ?? [])
    .filter((row) => row.shape === 'prose')
    .map(({ id, role, text }) => ({ id, role, text }))
