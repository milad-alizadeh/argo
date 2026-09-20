import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { createSessionReader } from '@/domains/sessions/main/observation/reader'
import { listed } from '@/domains/sessions/main/observation/reader-test-helpers'

export const OPEN_TURN_THREAD = '01a0b000-0000-7000-8000-000000000001'

// A rollout codex-harness 0.147.0 wrote with its newest Turn still open.
export const OPEN_TURN_FIXTURE = fileURLToPath(
  new URL(
    '../../../../mocks/cli/codex/fixtures/sessions/rollout-codexOpenTurn.jsonl',
    import.meta.url,
  ),
)

// The `task_complete` that closes that Turn, in the shape the rollout writes it.
export const OPEN_TURN_COMPLETE = {
  type: 'task_complete',
  turn_id: '01a0b000-0000-7000-8000-00000000a001',
  last_agent_message: 'Checked.',
  started_at: 1789509320,
  completed_at: 1789509380,
  duration_ms: 60000,
}

export function rolloutPath(root: string, thread: string) {
  return path.join(root, '2026', '09', '15', `rollout-2026-09-15T22-55-19-${thread}.jsonl`)
}

// A transcript root holding the open-Turn rollout alone, removed when the test ends.
export async function openTurnRolloutRoot(context: {
  after: (cleanup: () => Promise<void>) => void
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-rollout-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const rollout = rolloutPath(root, OPEN_TURN_THREAD)
  await mkdir(path.dirname(rollout), { recursive: true })
  await copyFile(OPEN_TURN_FIXTURE, rollout)
  return { root, rollout }
}

export async function rosterRows(reader: ReturnType<typeof createSessionReader>) {
  const reply = await listed(reader)
  return reply?.sessions.map(({ id, posture, status, locked }) => ({ id, posture, status, locked }))
}
