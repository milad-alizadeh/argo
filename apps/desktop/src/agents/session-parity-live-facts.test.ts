import assert from 'node:assert/strict'
import { copyFile, mkdir, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions'
import { readerOverRollout } from '@/agents/codex/sessions/rollout-reader-test-helper'
import { managedRow } from '@/domains/sessions/main/managed-row'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { listed, tempRoot } from '@/domains/sessions/main/reader-test-helpers'

const FIXTURES = fileURLToPath(new URL('../../mocks/cli', import.meta.url))
const COMPACTING_SINCE = new Date().toISOString()

async function claudeReader(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await tempRoot(context)
  const transcripts = path.join(root, 'transcripts')
  const starts = path.join(root, 'compactions')
  await mkdir(path.join(transcripts, 'project-one'), { recursive: true })
  await mkdir(starts)
  await copyFile(
    path.join(FIXTURES, 'claude/fixtures/sessions/parityExecute.jsonl'),
    path.join(transcripts, 'project-one/parityExecute.jsonl'),
  )
  const start = path.join(starts, 'parityExecute.json')
  await writeFile(start, JSON.stringify({ session_id: 'parityExecute' }))
  await utimes(start, new Date(COMPACTING_SINCE), new Date(COMPACTING_SINCE))
  return createSessionReader([claudeSessionSource({ transcripts, compactionStarts: starts })])
}

async function compactingSince(reader: ReturnType<typeof createSessionReader>) {
  const row = (await listed(reader))?.sessions.find(({ id }) => id === 'parityExecute')
  return row?.compactionStartedAt ?? null
}

test('a running compaction reads from each harness Session source', async (context) => {
  const claude = await claudeReader(context)
  const codex = await readerOverRollout(
    context,
    { fixture: 'rollout-parityExecute.jsonl', session: 'parityExecute' },
    {
      roster: () => [
        managedRow('parityExecute', {
          cli: 'codex',
          cwd: '/Users/x/project-one',
          status: 'running',
          setup: { model: null, effort: null, mode: null },
          prompt: 'Run the command.',
          startedAt: COMPACTING_SINCE,
          compactionStartedAt: COMPACTING_SINCE,
        }),
      ],
    },
  )
  assert.equal(await compactingSince(claude), COMPACTING_SINCE)
  assert.equal(await compactingSince(codex), COMPACTING_SINCE)
})

test('Codex declares an absent Shell output tail', async (context) => {
  const reader = await readerOverRollout(context, {
    fixture: 'rollout-parityExecute.jsonl',
    session: 'parityExecute',
  })
  await listed(reader)
  const reply = await reader.readShellOutput({
    version: 1,
    type: 'session.shell.output',
    requestId: 'output-1',
    sessionId: 'parityExecute',
    shellId: 'command-1',
  })
  assert.deepEqual(reply.type === 'session.shell.output.read' ? reply.output : null, {
    state: 'absent',
  })
})
