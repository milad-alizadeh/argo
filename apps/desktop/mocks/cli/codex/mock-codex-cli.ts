// The Codex adapter's own answers about its mock (#2308). The mock app-server completes a Turn
// without a message of its own, so the mark a case waits for is the prompt the Turn carried, and
// the rollouts land under the transcript root itself.
import { execFileSync } from 'node:child_process'
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MockHarness } from '../mock-cli'

// A `codex` that answers the version and login probes, then serves the mock app-server. Its thread
// state lives beside it unless the launch names another file.
export async function writeMockCodexLive(root: string) {
  const bun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim()
  const server = path.resolve('mocks/cli/codex/mock-codex-live.mts')
  const executable = path.join(root, 'codex')
  const state = path.join(root, 'codex-state.json')
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'codex-cli 0.147.0'; exit 0; fi\nif [ "$1" = "login" ]; then echo 'Logged in using ChatGPT'; exit 0; fi\nexport ARGO_CODEX_E2E_STATE="\${ARGO_CODEX_E2E_STATE:-${state}}"\nexec "${bun}" "${server}"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}

export const mockCodexHarness: MockHarness = {
  write: writeMockCodexLive,
  folder: (transcripts) => transcripts,
  replyMark: (prompt) => prompt,
}
