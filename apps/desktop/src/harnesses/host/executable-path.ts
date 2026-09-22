import { execFileSync } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import * as path from 'node:path'

// A GUI-launched process inherits a bare PATH, not the login shell's — so a Harness installed through
// a version manager (nvm, asdf) is invisible until this asks the shell itself (#1951).
function loginShellPath(shell: string | undefined, fallback: string): string {
  if (!shell) return fallback
  try {
    const output = execFileSync(shell, ['-ilc', 'printf \'%s\\n\' "$PATH"'], { encoding: 'utf8' })
    return output.trim().split('\n').at(-1) || fallback
  } catch {
    return fallback
  }
}

// Finds `name` on the login shell's PATH, the way a terminal would, for any Harness. Shared by every
// system wiring that spawns a Harness Argo does not bundle (ADR-0021: this is wiring, not one Harness's).
export function findExecutableOnLoginShellPath(name: string): string | null {
  const fallback = process.env.PATH ?? '/usr/bin:/bin'
  return (
    loginShellPath(process.env.SHELL, fallback)
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
