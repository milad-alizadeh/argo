import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSessionReader } from '@/domains/sessions/main/observation/reader/reader'
import { fed, feedRequest, rowsOf } from '@/domains/sessions/main/observation/reader/reader-test-helpers'
import { codexSessionSource } from './read-sessions'

const SESSION = 'codexReasoningSummary'
const FIXTURE = fileURLToPath(
  new URL(
    '../../../../mocks/cli/codex/fixtures/sessions/rollout-codexReasoningSummary.jsonl',
    import.meta.url,
  ),
)

test('shows Codex reasoning summaries as commentary between the prompt and reply', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-reasoning-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '17')
  await mkdir(day, { recursive: true })
  await copyFile(FIXTURE, path.join(day, `${SESSION}.jsonl`))
  const reader = createSessionReader([codexSessionSource(root)])

  const rows = rowsOf(await fed(reader, feedRequest(SESSION)))

  assert.deepEqual(
    rows.map(({ shape, ...row }) => ({ shape, ...('text' in row ? { text: row.text } : {}) })),
    [
      { shape: 'prose', text: 'Inspect the Session lifecycle.' },
      { shape: 'thought', text: 'Revising session lifecycle handling' },
      { shape: 'prose', text: 'The lifecycle is ready.' },
    ],
  )
})
