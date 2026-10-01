// The Codex adapter's own answers about its mock (#2308). The mock app-server completes a Turn
// without a message of its own, so the mark a case waits for is the prompt the Turn carried.
import { execFileSync } from 'node:child_process'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MockHarness } from '../mock-cli'
import { codexRecording } from './recorded-codex-threads.ts'

// The CLI version the Codex recordings under fixtures/ came from.
export const MOCK_CODEX_VERSION = codexRecording.version

// A `codex` that answers the version and login probes, then serves the mock app-server. Its thread
// state lives beside it unless the launch names another file.
export async function writeMockCodexLive(root: string) {
  const bun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim()
  const server = path.resolve('mocks/cli/codex/mock-codex-live.mts')
  const executable = path.join(root, 'codex')
  const state = mockCodexStateFile(root)
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'codex-cli ${MOCK_CODEX_VERSION}'; exit 0; fi\nif [ "$1" = "login" ]; then echo 'Logged in using ChatGPT'; exit 0; fi\nexport ARGO_CODEX_E2E_STATE="\${ARGO_CODEX_E2E_STATE:-${state}}"\nexec "${bun}" "${server}"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}

// The threads the mock app-server answers `thread/list` and `thread/read` from, in that shape.
export function mockCodexStateFile(root: string) {
  return path.join(root, 'codex-state.json')
}

async function recordedByCodex(root: string, _transcripts: string, mark: string) {
  const stored = await readFile(mockCodexStateFile(root), 'utf8').catch(() => '[]')
  return stored.includes(JSON.stringify(mark).slice(1, -1))
}

export const mockCodexHarness: MockHarness = {
  write: writeMockCodexLive,
  replyMark: (prompt) => prompt,
  recorded: recordedByCodex,
}
