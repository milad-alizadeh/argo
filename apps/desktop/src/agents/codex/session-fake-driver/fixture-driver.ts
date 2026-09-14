// Shared by the #1839 vertical-slice tests: a real child process running
// fixtures/fake-codex-app-server.ts stands in for `codex app-server`, wired through the real
// CodexChannel transport rather than an in-memory fake.
import { spawn } from 'node:child_process'
import { chmod, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { openCodexChannel } from '../drive/codex-channel.ts'
import { createCodexSessionDriver } from '../drive/codex-session-driver.ts'
import type { CodexOwnershipLedger } from '../drive/ownership-ledger.ts'

const fixturePath = import.meta.url.endsWith('.mjs')
  ? './fake-codex-app-server.mjs'
  : './fixtures/fake-codex-app-server.ts'
const fixture = fileURLToPath(new URL(fixturePath, import.meta.url))

export function driverBackedByFixture(
  driverOptions: {
    ownership?: CodexOwnershipLedger
    env?: Record<string, string>
    resumeTarget?: (sessionId: string) => Promise<{ cwd: string } | null>
  } = {},
) {
  return createCodexSessionDriver({
    findExecutable: () => process.execPath,
    now: () => new Date(),
    ownership: driverOptions.ownership,
    resumeTarget: driverOptions.resumeTarget ?? (async () => null),
    openChannel: (executable, options) => {
      const child = spawn(executable, [fixture], {
        cwd: options.cwd,
        env: { ...options.env, ...driverOptions.env },
      })
      child.stderr.on('data', () => {})
      return openCodexChannel({
        stdout: child.stdout,
        write: (line) => child.stdin.write(line),
        kill: () => child.kill(),
        onExit: (listener) => {
          child.on('close', listener)
          child.on('error', listener)
        },
      })
    },
  })
}

export async function ownerCliFor() {
  return 'codex'
}

export async function writeFakeCodex(root: string) {
  const executable = `${root}/codex`
  await writeFile(
    executable,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${fixture}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}
