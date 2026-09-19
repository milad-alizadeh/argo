import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSessionReader } from '../domains/sessions/main/reader'
import { fed, feedRequest, listed, rowsOf } from '../domains/sessions/main/reader-test-helpers'
import { claudeSessionSource } from './claude/sessions/read-sessions'
import { readerOverRollout } from './codex/sessions/rollout-reader-test-helper'

const SESSIONS = fileURLToPath(new URL('../../mocks/cli', import.meta.url))
export type Context = { after: (cleanup: () => Promise<void>) => void }

const HARNESSES = {
  claude: async (context: Context, session: string) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'argo-parity-claude-'))
    context.after(() => rm(root, { recursive: true, force: true }))
    await mkdir(path.join(root, 'project-one'), { recursive: true })
    await copyFile(
      path.join(SESSIONS, `claude/fixtures/sessions/${session}.jsonl`),
      path.join(root, 'project-one', `${session}.jsonl`),
    )
    return createSessionReader([claudeSessionSource({ transcripts: root })])
  },
  codex: (context: Context, session: string) =>
    readerOverRollout(context, { fixture: `rollout-${session}.jsonl`, session }),
}

export async function read(
  harness: keyof typeof HARNESSES,
  context: Context,
  session = 'parityExecute',
) {
  const reader = await HARNESSES[harness](context, session)
  const feed = rowsOf(await fed(reader, feedRequest(session)))
  const roster = (await listed(reader))?.sessions.find((row) => row.id === session)
  assert.ok(roster !== undefined, `${harness} lists the Session`)
  return { feed, roster }
}
