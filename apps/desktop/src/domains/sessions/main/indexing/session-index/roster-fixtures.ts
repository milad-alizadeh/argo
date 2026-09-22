// The two CLIs' transcripts, written the way each Harness writes them, so one indexed-Roster proof
// runs over both adapters rather than over shared code with a stub Harness beneath it (#2372).
import { mkdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { claudeSessionSource } from '@/harnesses/claude/sessions'
import { codexSessionSource } from '@/harnesses/codex/sessions'
import type { SessionSource } from '../../observation'
import type { SessionIndex } from './contract'

// `resumeOf` is the Session this transcript continues, written the way each Harness writes a resume:
// Claude names the predecessor's uuid, Codex carries the origin thread id on every message.
export type Transcript = {
  id: string
  prompt: string
  reply?: string
  cwd: string
  at: string
  resumeOf?: string
}

// Codex names a rollout for its day and its Session id together, and only the uuid in it is the
// id. A fixture named `<id>.jsonl` would never exercise that, so these carry the real shape.
function codexFileName(id: string) {
  return `rollout-2026-09-13T12-00-00-${id}.jsonl`
}

export type IndexedAdapter = {
  harness: string
  write: (root: string, transcripts: readonly Transcript[]) => Promise<void>
  source: (root: string, index: SessionIndex) => SessionSource
}

async function writeAt(file: string, lines: unknown[], at: string) {
  await writeFile(file, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`)
  await utimes(file, new Date(at), new Date(at))
}

const claude: IndexedAdapter = {
  harness: 'claude',
  write: async (root, transcripts) => {
    for (const transcript of transcripts) {
      const project = path.join(root, 'project-one')
      await mkdir(project, { recursive: true })
      await writeAt(
        path.join(project, `${transcript.id}.jsonl`),
        [
          ...(transcript.resumeOf === undefined
            ? []
            : [{ type: 'last-prompt', leafUuid: `${transcript.resumeOf}-a` }]),
          {
            type: 'user',
            uuid: `${transcript.id}-u`,
            timestamp: transcript.at,
            cwd: transcript.cwd,
            sessionId: transcript.id,
            message: { role: 'user', content: transcript.prompt },
          },
          {
            type: 'assistant',
            uuid: `${transcript.id}-a`,
            timestamp: transcript.at,
            cwd: transcript.cwd,
            sessionId: transcript.id,
            message: {
              role: 'assistant',
              stop_reason: 'end_turn',
              content: [{ type: 'text', text: transcript.reply ?? 'Done.' }],
            },
          },
        ],
        transcript.at,
      )
    }
  },
  source: (root, index) => claudeSessionSource({ transcripts: root, index }),
}

const codex: IndexedAdapter = {
  harness: 'codex',
  write: async (root, transcripts) => {
    for (const transcript of transcripts) {
      const day = path.join(root, '2026', '09', '13')
      await mkdir(day, { recursive: true })
      await writeAt(
        path.join(day, codexFileName(transcript.id)),
        [
          {
            timestamp: transcript.at,
            type: 'session_meta',
            payload: { id: transcript.id, cwd: transcript.cwd },
          },
          {
            timestamp: transcript.at,
            ordinal: 1,
            type: 'event_msg',
            payload: {
              type: 'item_completed',
              thread_id: transcript.resumeOf ?? transcript.id,
              turn_id: 'turn-1',
              item: {
                type: 'UserMessage',
                id: `${transcript.id}-u`,
                content: [{ type: 'text', text: transcript.prompt, text_elements: [] }],
              },
            },
          },
          {
            timestamp: transcript.at,
            ordinal: 2,
            type: 'event_msg',
            payload: {
              type: 'item_completed',
              thread_id: transcript.resumeOf ?? transcript.id,
              turn_id: 'turn-1',
              item: {
                type: 'AgentMessage',
                id: `${transcript.id}-a`,
                content: [{ type: 'Text', text: transcript.reply ?? 'Done.' }],
              },
            },
          },
        ],
        transcript.at,
      )
    }
  },
  // No Codex process holds a fixture open, and `lsof` is the one call here the index does not own.
  source: (root, index) => codexSessionSource(root, { index, listOpenFiles: async () => '' }),
}

export const indexedAdapters: IndexedAdapter[] = [claude, codex]

// A uuid whose last digits count the Session, so the Nth newest is readable in a failure and
// Codex's own `rollout-<day>-<uuid>` name still resolves back to it.
export function sessionIdAt(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

// Sessions spaced a minute apart so their mtimes never tie, newest first at index 0, the
// convention the adapters' own window proofs already use.
export function manyTranscripts(count: number, cwd = '/proj'): Transcript[] {
  const base = Date.parse('2026-09-13T12:00:00.000Z')
  return Array.from({ length: count }, (_, index) => ({
    id: sessionIdAt(index),
    prompt: `Session ${index}.`,
    cwd,
    at: new Date(base - index * 60_000).toISOString(),
  }))
}
