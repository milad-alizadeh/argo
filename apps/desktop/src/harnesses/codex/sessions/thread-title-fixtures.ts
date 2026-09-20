import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sessionListReplySchema } from '@/domains/sessions/contract/contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'
import { codexStatePath } from '@/harnesses/codex/sessions/roots'
import { readThreadNames } from '@/harnesses/codex/sessions/thread-names'

export const CREATED_THREAD = 'codexCreatedThread'
export const DELEGATED_REQUEST =
  'Implement the approved Geist desktop typography contract for Argo issue #2235.'
export const THREADS_SCHEMA = 'CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT, name TEXT)'

const FIXTURE = fileURLToPath(
  new URL(
    `../../../../mocks/harness/codex/fixtures/sessions/rollout-${CREATED_THREAD}.jsonl`,
    import.meta.url,
  ),
)

type Context = { after: (cleanup: () => Promise<void>) => void }

// A Codex home as the desktop app lays it out: `sessions/` for rollouts, the state store beside it.
export async function codexHome(context: Context) {
  const home = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-titles-'))
  context.after(() => rm(home, { recursive: true, force: true }))
  const transcripts = path.join(home, 'sessions')
  const day = path.join(transcripts, '2026', '09', '15')
  await mkdir(day, { recursive: true })
  await copyFile(FIXTURE, path.join(day, `${CREATED_THREAD}.jsonl`))
  return { transcripts, day, state: codexStatePath(transcripts) }
}

export function writeStateStore(file: string, schema: string, rows: [string, string | null][]) {
  const store = new Database(file, { create: true })
  store.run(schema)
  for (const [id, name] of rows)
    store.run('INSERT INTO threads (id, name) VALUES (?, ?)', [id, name])
  store.close()
}

const openReadOnly = (file: string) => new Database(file, { readonly: true })

export async function rosterTitles(
  transcripts: string,
  state: string,
  roster: SessionRosterRow[] = [],
) {
  const reader = createSessionReader([
    codexSessionSource(transcripts, {
      threadNames: readThreadNames(state, openReadOnly),
      roster: () => roster,
    }),
  ])
  const reply = sessionListReplySchema.parse(
    await reader.listSessions({
      version: 1,
      type: 'session.list',
      requestId: 'list-1',
      projectRoot: null,
    }),
  )
  assert.equal(reply.type, 'session.listed')
  return Object.fromEntries(reply.sessions.map((session) => [session.id, session.title]))
}
