// Shared by the #1839 vertical-slice tests: a real child process running
// fixtures/fake-codex-app-server.ts stands in for `codex app-server`, wired through the real
// CodexChannel transport rather than an in-memory fake.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { openCodexChannel } from '../drive/codex-channel.ts'
import { createCodexSessionDriver } from '../drive/codex-session-driver.ts'

const fixture = fileURLToPath(new URL('./fixtures/fake-codex-app-server.ts', import.meta.url))

export function driverBackedByFixture() {
  return createCodexSessionDriver({
    findExecutable: () => process.execPath,
    now: () => new Date(),
    openChannel: (executable, options) => {
      const child = spawn(executable, [fixture], { cwd: options.cwd, env: options.env })
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
