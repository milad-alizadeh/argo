import { execFileSync } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import * as path from 'node:path'

const SHELL_READ_TIMEOUT_MS = 5_000
// A miss re-reads the PATH this rarely, so missing Harnesses at launch do not each start a shell.
const MISS_REREAD_INTERVAL_MS = 30_000

// A GUI-launched process inherits a bare PATH, not the login shell's — so a Harness installed through
// a version manager (nvm, asdf) is invisible until this asks the shell itself (#1951).
function readLoginShellPath(shell: string): string | undefined {
  try {
    const output = execFileSync(shell, ['-ilc', 'printf \'%s\\n\' "$PATH"'], {
      encoding: 'utf8',
      timeout: SHELL_READ_TIMEOUT_MS,
    })
    return output.trim().split('\n').at(-1) || undefined
  } catch {
    return undefined
  }
}

// Only a successful read is kept, so a failed or timed-out one is retried by the next lookup (#3061).
let lastRead: { key: string; path: string; readAt: number } | undefined

function rereadLoginShellPath(shell: string, key: string, fallback: string): string {
  const read = readLoginShellPath(shell)
  if (read !== undefined) lastRead = { key, path: read, readAt: Date.now() }
  return lastRead?.key === key ? lastRead.path : fallback
}

function executableOn(searchPath: string, name: string): string | null {
  return (
    searchPath
      .split(path.delimiter)
      .map((directory) => path.join(directory, name))
      .find((candidate) => {
        try {
          accessSync(candidate, constants.X_OK)
          return true
        } catch {
          return false
        }
      }) ?? null
  )
}

// Finds `name` on the login shell's PATH, the way a terminal would, for any Harness. Shared by every
// system wiring that spawns a Harness Argo does not bundle (ADR-0021: this is wiring, not one Harness's).
export function findExecutableOnLoginShellPath(name: string): string | null {
  const fallback = process.env.PATH ?? '/usr/bin:/bin'
  const shell = process.env.SHELL
  if (!shell) return executableOn(fallback, name)
  const key = `${shell}\0${fallback}`
  if (lastRead?.key !== key) return executableOn(rereadLoginShellPath(shell, key, fallback), name)
  const found = executableOn(lastRead.path, name)
  if (found || Date.now() - lastRead.readAt < MISS_REREAD_INTERVAL_MS) return found
  // A Harness installed since the last read may have added a folder to the login PATH.
  return executableOn(rereadLoginShellPath(shell, key, fallback), name)
}
