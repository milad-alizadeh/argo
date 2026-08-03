import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Match the `claude` executable itself, not any command line that merely contains the string
// (a path under ~/.claude, the Argo app), which would manufacture a false running.
const CLAUDE_COMMAND = /(^|\/)claude(\s|$)/

// Best-effort process probe (the untested I/O shell): match live `claude` processes by cwd. Any
// failure (no `ps`/`lsof`, a locked-down host) returns [], so liveness resolves down to idle.
// The match is NOT a unique key — two `claude` in one repo can mis-match — which is why every
// status it feeds is DERIVED for a session Argo does not own (CONTEXT.md, honesty tier).
export async function gatherClaudeProcesses(): Promise<{ cwd: string }[]> {
  try {
    const { stdout } = await run('ps', ['-axo', 'pid=,command='])
    const pids = stdout
      .split('\n')
      .filter((line) => CLAUDE_COMMAND.test(line))
      .map((line) => line.trim().split(/\s+/, 1)[0])
      .filter((pid) => /^\d+$/.test(pid))

    const cwds = await Promise.all(pids.map(processCwd))
    return cwds.filter((cwd): cwd is string => cwd !== null).map((cwd) => ({ cwd }))
  } catch {
    return []
  }
}

async function processCwd(pid: string): Promise<string | null> {
  try {
    const { stdout } = await run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
    const line = stdout.split('\n').find((entry) => entry.startsWith('n'))
    return line ? line.slice(1) : null
  } catch {
    return null
  }
}
