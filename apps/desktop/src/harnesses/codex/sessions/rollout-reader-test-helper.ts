import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createSessionReader } from '@/domains/sessions/main/reader'
import { codexSessionSource, type ReaderOptions } from '@/harnesses/codex/sessions/read-sessions'

// A Session reader over one mock rollout copied into a temp Codex root, removed after the test.
export async function readerOverRollout(
  context: { after: (cleanup: () => Promise<void>) => void },
  mock: { fixture: string; session: string },
  options?: ReaderOptions,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-rollout-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const day = path.join(root, '2026', '09', '19')
  await mkdir(day, { recursive: true })
  await copyFile(
    new URL(`../../../../mocks/harness/codex/fixtures/sessions/${mock.fixture}`, import.meta.url),
    path.join(day, `${mock.session}.jsonl`),
  )
  return createSessionReader([codexSessionSource(root, options)])
}
