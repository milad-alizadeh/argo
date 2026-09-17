import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSessionReader } from '@/core/sessions/reader'
import { fed, feedRequest, listed, rowsOf } from '@/core/sessions/reader-test-helpers'
import { codexSessionSource } from './read-sessions'

const SESSION = 'codexToolCalls'
const FIXTURE = fileURLToPath(
  new URL(
    '../../../../mocks/cli/codex/fixtures/sessions/rollout-codexToolCalls.jsonl',
    import.meta.url,
  ),
)

async function reader(context: { after: (cleanup: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-tool-calls-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '16')
  await mkdir(day, { recursive: true })
  await copyFile(FIXTURE, path.join(day, `${SESSION}.jsonl`))
  return createSessionReader([codexSessionSource(root)])
}

test('shows a row for each Codex tool call, succeeded once its output arrived and running otherwise', async (context) => {
  const rows = rowsOf(await fed(await reader(context), feedRequest(SESSION)))
  const [group] = rows
  assert.equal(rows.length, 1)
  assert.ok(group?.shape === 'tool-group')
  assert.deepEqual(
    group.calls.map(({ status, label, text }) => ({ status, label, text })),
    [
      {
        status: 'succeeded',
        label: 'Ran bun test session-store.test.ts',
        text: 'bun test session-store.test.ts',
      },
      {
        status: 'succeeded',
        label: 'Ran bun test session-store.test.ts',
        text: 'bun test session-store.test.ts',
      },
      { status: 'failed', label: 'Ran bun run lint', text: 'bun run lint' },
      { status: 'running', label: 'Ran bun run build', text: 'bun run build' },
      {
        status: 'succeeded',
        label: 'Ran bun run quality',
        text: 'bun run quality',
      },
      {
        status: 'succeeded',
        label: 'Called update_plan',
        text: 'const result = await tools.update_plan({ plan: [{ step: "Inspect the Session", status: "in_progress" }] });\ntext(result);',
      },
    ],
  )
})

test('names the roster activity line after the newest tool call, the same way it does for Claude', async (context) => {
  const reply = await listed(await reader(context))
  const session = reply?.sessions.find((entry) => entry.id === SESSION)
  assert.deepEqual(session?.activity, {
    label: 'Called update_plan',
    tool: 'update_plan',
    target: null,
  })
})
