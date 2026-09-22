import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { codexReadiness } from './codex-readiness'

const execFileAsync = promisify(execFile)

// `executable` names a proof's mock `codex`; a person's launch finds the real one on login PATH.
export function createSystemCodexReadiness(executable?: string): () => Promise<HarnessReadiness> {
  const findExecutable = () => executable ?? findExecutableOnLoginShellPath('codex')
  return () =>
    codexReadiness({
      findExecutable,
      runStatus: async () => {
        const path = findExecutable()
        if (!path) return { stdout: '', stderr: '' }
        try {
          const { stdout, stderr } = await execFileAsync(path, ['login', 'status'])
          return { stdout, stderr }
        } catch (error) {
          const failure = error as { stdout?: unknown; stderr?: unknown }
          return {
            stdout: typeof failure.stdout === 'string' ? failure.stdout : '',
            stderr: typeof failure.stderr === 'string' ? failure.stderr : '',
          }
        }
      },
    })
}
