import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// A repository with thousands of refs overflows execFile's 1 MB default and the read fails as
// if git had refused, so the ceiling is raised past any plausible ref list.
const OUTPUT_CEILING_BYTES = 8 * 1024 * 1024

/** One git invocation's outcome: whether git exited clean, and its own words on both streams. */
export interface GitOutput {
  ok: boolean
  stdout: string
  stderr: string
}

// The ONLY place this process spawns git. An argument ARRAY rather than a shell string, so a
// branch name carrying a space, a quote or a `;` stays one argument instead of becoming a second
// command. Credential prompting is off: main has no terminal to answer one on, so an
// unauthenticated fetch must fail fast rather than hang the process forever.
export async function runGit(repoPath: string, args: string[]): Promise<GitOutput> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: OUTPUT_CEILING_BYTES,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    return { ok: true, stdout, stderr }
  } catch (error) {
    return { ok: false, stdout: '', stderr: refusal(error) }
  }
}

// git writes the reason it refused to stderr and exits non-zero, which execFile surfaces as a
// throw carrying that output. Reporting git's words verbatim is the only honest answer — the
// shell shows them rather than inventing an explanation.
function refusal(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'stderr' in error) {
    const { stderr } = error
    if (typeof stderr === 'string' && stderr.trim() !== '') return stderr
  }
  return error instanceof Error ? error.message : String(error)
}
