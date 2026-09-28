import { execFileSync } from 'node:child_process'
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'

// A `codex` that answers the version and login probes, then serves the mock app-server.
export async function writeMockCodex(root: string) {
  const bun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim()
  const server = path.resolve('mocks/cli/codex/mock-codex-live.mts')
  const executable = path.join(root, 'mock-codex')
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'codex-cli 0.147.0'; exit 0; fi\nif [ "$1" = "login" ]; then echo 'Logged in using ChatGPT'; exit 0; fi\nexec "${bun}" "${server}"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}
