// Shared by the #1839 vertical-slice tests: a real child process running
// mock-codex-app-server.ts stands in for `codex app-server`, wired through the real
// CodexChannel transport rather than an in-memory mock.
import { spawn } from 'node:child_process'
import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { openCodexChannel } from '../../../src/agents/codex/drive/codex-channel.ts'
import { createCodexSessionDriver } from '../../../src/agents/codex/drive/codex-session-driver.ts'
import type { OwnershipLedger } from '../../../src/domains/sessions/main/ownership-ledger.ts'

// The proof always starts in `apps/desktop`, as `session-resume-case.ts`'s mock Claude notes:
// `import.meta.url` is unavailable once the Playwright test runner loads this module as CommonJS.
const fixture = path.join(process.cwd(), 'mocks', 'cli', 'codex', 'mock-codex-app-server.ts')

export function driverBackedByFixture(
  driverOptions: {
    ownership?: OwnershipLedger
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

export async function writeMockCodex(root: string) {
  const executable = `${root}/codex`
  await writeFile(
    executable,
    `#!/bin/sh\nexec "${process.execPath}" --no-warnings "${fixture}" "$@"\n`,
  )
  await chmod(executable, 0o755)
  return executable
}
