import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { Hub } from '../hub'
import { parseTranscript } from './claudeTranscript'
import { discoverWorkingSet } from './discover'
import { deriveLiveness, gatherClaudeProcesses } from './liveness'
import { toObservedSession, toSessionEvent } from './observedSession'
import { latestInChain, stitch } from './resumeChain'
import type { LogicalSession } from './types'

export { parseTranscript } from './claudeTranscript'
export { discoverWorkingSet, selectWorkingSet, WORKING_SET_WINDOW_MS } from './discover'
export { deriveLiveness, gatherClaudeProcesses } from './liveness'
export { toObservedSession, toSessionEvent } from './observedSession'
export { latestInChain, stitch } from './resumeChain'
export type * from './types'

interface ObservationOptions {
  root?: string
  now?: () => number
}

// Seam B's launch sweep: discover the working set → stitch resume chains → grade liveness → apply
// one session-created event per Session. Idempotent at the hub, so a single launch sweep suffices;
// incremental tailing of live per-Session events awaits the enriched vocabulary in #5.
export async function startObservation(hub: Hub, options: ObservationOptions = {}): Promise<void> {
  const root = options.root ?? join(homedir(), '.claude', 'projects')
  const nowMs = (options.now ?? Date.now)()

  try {
    const paths = await discoverWorkingSet(root, nowMs)
    const parsed = await Promise.all(
      paths.map(async (path) => {
        const contents = await readFile(path, 'utf8')
        return parseTranscript(basename(path, '.jsonl'), contents.split('\n'))
      }),
    )

    const processCwds = new Set((await gatherClaudeProcesses()).map((process) => process.cwd))

    for (const logical of stitch(parsed)) {
      const status = deriveLiveness({
        processMatch: matchesLiveProcess(logical, processCwds),
        lastTimestampMs: latestInChain(logical.files, (file) => file.lastTimestampMs),
        nowMs,
      })
      hub.apply(toSessionEvent(toObservedSession(logical, status)))
    }
  } catch {
    // A machine that never ran claude (no ~/.claude/projects) is a clean no-op, not a crash.
  }
}

function matchesLiveProcess(logical: LogicalSession, processCwds: Set<string>): boolean {
  return logical.files.some((file) => file.cwd !== null && processCwds.has(file.cwd))
}
