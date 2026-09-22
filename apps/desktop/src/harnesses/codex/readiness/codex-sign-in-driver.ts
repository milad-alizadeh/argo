// Spawns `codex login`, the CLI's own browser sign-in (grounded via `codex login --help`, 0.147.0:
// no subcommand runs the default ChatGPT device/browser flow). The process opens the browser
// itself and blocks until the flow ends, so login() resolves only then.
import { type ChildProcess, spawn } from 'node:child_process'
import type { HarnessSignInDriver } from '@/domains/harness-signin/main/harness-sign-in'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { runLoginProcess } from '@/harnesses/host/run-login-process'
import { createSystemCodexReadiness } from './system-codex-readiness'

export type CodexLoginSpawn = (executable: string, args: string[]) => ChildProcess

const defaultSpawn: CodexLoginSpawn = (executable, args) =>
  spawn(executable, args, { stdio: 'ignore' })

// `executable` names a proof's mock `codex`; a person's launch finds the real one on login PATH.
export function createCodexSignInDriver(
  executable?: string,
  spawnLogin: CodexLoginSpawn = defaultSpawn,
): HarnessSignInDriver {
  const findExecutable = () => executable ?? findExecutableOnLoginShellPath('codex')
  return {
    checkReadiness: createSystemCodexReadiness(executable),
    login(signal) {
      const path = findExecutable()
      if (!path) return Promise.resolve('failed')
      return runLoginProcess(spawnLogin(path, ['login']), signal)
    },
  }
}
