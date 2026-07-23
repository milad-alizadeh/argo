import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { derived, type SessionStatus, type Tiered } from '../../shared'

const run = promisify(execFile)

// A live process can sit quiet mid-tool; only a transcript touched within this window
// corroborates an actively-running session — beyond it, ambiguity resolves down.
const RECENT_ACTIVITY_MS = 10 * 60 * 1000

// Match the `claude` executable itself, not any command line that merely contains the string
// (a path under ~/.claude, the Argo app), which would manufacture a false running.
const CLAUDE_COMMAND = /(^|\/)claude(\s|$)/

export interface LivenessSignals {
  processMatch: boolean
  lastTimestampMs: number | null
  nowMs: number
}

// An external Session's liveness is ALWAYS DERIVED (ADR-0008): Argo owns no pid. Running needs
// BOTH a cwd process match AND a recent transcript (AC: process-match on cwd+recency plus mtime);
// any ambiguity resolves down to 'orphaned' — never 'done', a green-check success we never saw.
export function deriveLiveness(signals: LivenessSignals): Tiered<SessionStatus> {
  if (signals.processMatch && isRecent(signals)) return derived('running')
  return derived('orphaned')
}

function isRecent({ lastTimestampMs, nowMs }: LivenessSignals): boolean {
  return lastTimestampMs !== null && nowMs - lastTimestampMs <= RECENT_ACTIVITY_MS
}

// Best-effort process probe (the untested I/O shell): match live `claude` processes by cwd. Any
// failure (no `ps`/`lsof`, a locked-down host) returns [], so liveness resolves down to exited.
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
