// The Codex threads the mock app-server starts with, written for a packaged proof or a dev run.
import { mkdir, writeFile } from 'node:fs/promises'
import { mockCodexStateFile } from '../cli/codex/mock-codex-cli'
import { recordedThread } from '../cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '../cli/recorded-prompts'
import { fixtureSessionId, proofCwd } from './mock-transcript-files'

// One recorded Codex thread, renamed and placed for this run, in `thread/read`'s shape. The time
// keeps it in the same place in the Session List as the Claude fixtures.
function codexThread(request: { name: string; cwd: string; updatedAt: string; title: string }) {
  return {
    ...recordedThread(request.title),
    id: fixtureSessionId(request.name),
    cwd: request.cwd,
    updatedAt: Math.floor(Date.parse(request.updatedAt) / 1000),
    name: request.title,
  }
}

export const CODEX_PARENT = 'codexParent'
export const CODEX_FIXTURES = [CODEX_PARENT, 'codexChild'] as const

// The Codex threads the mock app-server starts with.
export async function writeCodexThreads(root: string, codexTranscripts: string) {
  const cwd = proofCwd(codexTranscripts, 'codex')
  // A send resumes in the recorded folder and fails when it is gone.
  await mkdir(cwd, { recursive: true })
  const threads = [
    codexThread({
      name: CODEX_PARENT,
      cwd,
      updatedAt: '2026-01-10T08:00:05.000Z',
      title: RECORDED_PROMPTS.codexCommand,
    }),
    codexThread({
      name: CODEX_FIXTURES[1],
      cwd,
      updatedAt: '2026-01-10T08:30:05.000Z',
      title: RECORDED_PROMPTS.codexReply,
    }),
  ]
  await writeFile(mockCodexStateFile(root), JSON.stringify(threads))
}
