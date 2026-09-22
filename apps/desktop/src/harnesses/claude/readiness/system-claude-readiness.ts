import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { claudeCliEnvironment } from '../cli-environment'
import { claudeReadiness } from './claude-readiness'

const execFileAsync = promisify(execFile)

// `executable` names a proof's mock `claude`; a person's launch finds the real one on login PATH.
export function createSystemClaudeReadiness(executable?: string): () => Promise<HarnessReadiness> {
  const findExecutable = () => executable ?? findExecutableOnLoginShellPath('claude')
  return () =>
    claudeReadiness({
      findExecutable,
      runStatus: async () => {
        const path = findExecutable()
        if (!path) return { stdout: '' }
        try {
          const { stdout } = await execFileAsync(path, ['auth', 'status', '--json'], {
            env: claudeCliEnvironment(),
          })
          return { stdout }
        } catch (error) {
          const stdout = (error as { stdout?: unknown }).stdout
          return { stdout: typeof stdout === 'string' ? stdout : '' }
        }
      },
    })
}
