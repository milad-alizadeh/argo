// Spawns `claude auth login --claudeai`, the CLI's own browser sign-in (grounded via
// `claude auth login --help`, 2.1.278: `--claudeai` is already its default). The process opens
// the browser itself and blocks until the flow ends, so login() resolves only then.
import { type ChildProcess, spawn } from 'node:child_process'
import type { HarnessSignInDriver } from '@/domains/harness-signin/main/port'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { runLoginProcess } from '@/harnesses/host/run-login-process'
import { claudeCliEnvironment } from '../cli-environment'
import { createSystemClaudeReadiness } from './system-claude-readiness'

export type ClaudeLoginSpawn = (executable: string, args: string[]) => ChildProcess

const defaultSpawn: ClaudeLoginSpawn = (executable, args) =>
  spawn(executable, args, { env: claudeCliEnvironment(), stdio: 'ignore' })

// `executable` names a proof's mock `claude`; a person's launch finds the real one on login PATH.
export function createClaudeSignInDriver(
  executable?: string,
  spawnLogin: ClaudeLoginSpawn = defaultSpawn,
): HarnessSignInDriver {
  const findExecutable = () => executable ?? findExecutableOnLoginShellPath('claude')
  return {
    checkReadiness: createSystemClaudeReadiness(executable),
    login(signal) {
      const path = findExecutable()
      if (!path) return Promise.resolve('failed')
      return runLoginProcess(spawnLogin(path, ['auth', 'login', '--claudeai']), signal)
    },
  }
}
