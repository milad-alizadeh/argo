// The scaffolding a `scripts/*.fixture.mjs` needs to run a shipped shell script in a throwaway
// tree: executable files, the PATH stubs that record what the script asked for, and the two
// questions a suite asks about a process the script signalled.
//
// Shared rather than copied — two fixtures spelling the same tree out twice is how one of them
// ends up testing something the other already stopped doing.

import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { report as reportChecks } from './check-harness.mjs'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// A file the script will run: written and made executable in one step, because a scratch tree has
// no other kind.
export function write(file, body) {
  writeFileSync(file, body)
  chmodSync(file, 0o755)
}

// Stubs for the tools the script reaches through `PATH`. Every one logs `<name> <argv…>` on one
// line, so a failure can name both the tool and what it was told to do — "the script asked pgrep"
// and "the script asked ps" are different failures.
export function stubber(stubDir, callLog) {
  return (name, body = '') =>
    write(
      path.join(stubDir, name),
      `#!/bin/sh\nprintf '${name} %s\\n' "$*" >> '${callLog}'\n${body}`,
    )
}

export const readCalls = (callLog) =>
  existsSync(callLog) ? readFileSync(callLog, 'utf8').trimEnd().split('\n') : []

export function isRunning(pid) {
  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

// A script signals a process and returns without reaping it, so "did it go" is only answerable
// after a beat. Spun rather than slept, so a passing run costs only the beat it needs.
export function settled(pid) {
  const deadline = Date.now() + 5000
  while (isRunning(pid) && Date.now() < deadline) spawnSync('/bin/sleep', ['0.05'])
  return !isRunning(pid)
}

// The scratch tree is the fixture's to clean, so the shared report is wrapped rather than called
// directly — a suite that exits 1 must not leave the tree behind either.
export function reportAfterCleaning(scratch, suite) {
  rmSync(scratch, { recursive: true, force: true })
  reportChecks(suite)
}
