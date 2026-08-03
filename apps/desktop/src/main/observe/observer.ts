import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Hub } from '../hub'
import { parseTranscript } from './claudeTranscript'
import { discoverWorkingSet } from './discover'
import { gatherClaudeProcesses } from './liveness'
import { createManagedSessions, type ManagedSessions } from './managed'
import { toObservedSession, toSessionEvent, toSessionUpdate } from './observedSession'
import { firstInChain, latestInChain, stitch } from './resumeChain'
import { deriveSessionStatus } from './sessionStatus'
import type { LogicalSession, ObservedSession, ParsedTranscript } from './types'
import { type Watcher, watchTranscripts } from './watch'

// Seam B, incremental (ADR-0008). ONE launch sweep fills the per-file cache; from then on a
// recursive watch names the file that moved, that file alone is re-read, and only the Sessions
// whose observation actually changed emit. The sweep never runs again.

// `ps` + one `lsof` per pid is the heaviest thing here and the least likely to change between two
// appends of the same burst, so the probe is cached across a short window rather than re-run per
// re-read — a working agent writes many lines a second.
export const PROCESS_PROBE_TTL_MS = 5_000

export interface ObserverOptions {
  root: string
  now?: () => number
  managed?: ManagedSessions
  /** Watch after the sweep. Off for tests that drive `refresh` by hand. */
  watch?: boolean
  /** The live-process probe. Injected rather than reached for, so a test drives the one piece of
   * real I/O here through the seam instead of faking a module this repo owns. */
  probeProcesses?: () => Promise<{ cwd: string }[]>
}

export interface Observer {
  /** The launch sweep, then (unless disabled) the watch that keeps it current. */
  start(): Promise<void>
  /** Re-read ONE transcript file and publish whatever moved — the incremental path. */
  refresh(path: string): Promise<void>
  stop(): void
  /** The ownership registry spawn claims into, so posture survives in one place. */
  managed: ManagedSessions
}

interface Context {
  hub: Hub
  now: () => number
  managed: ManagedSessions
  probeProcesses: () => Promise<{ cwd: string }[]>
  byPath: Map<string, ParsedTranscript>
  published: Map<string, string>
  probed: { atMs: number; cwds: Set<string> }
}

async function liveCwds(context: Context, nowMs: number): Promise<Set<string>> {
  if (nowMs - context.probed.atMs < PROCESS_PROBE_TTL_MS) return context.probed.cwds
  context.probed = {
    atMs: nowMs,
    cwds: new Set((await context.probeProcesses()).map((process) => process.cwd)),
  }
  return context.probed.cwds
}

async function read(context: Context, path: string): Promise<void> {
  try {
    const contents = await readFile(path, 'utf8')
    context.byPath.set(path, parseTranscript(basename(path, '.jsonl'), contents.split('\n')))
  } catch {
    // A file that vanished between the watch event and the read is simply no longer observed;
    // its last parse stays in the cache rather than blanking a row that was real a moment ago.
  }
}

function observe(context: Context, logical: LogicalSession, cwds: Set<string>): ObservedSession {
  const cwd = latestInChain(logical.files, (file) => file.cwd)
  // Ownership is matched on the folder AND when the Session began, so an agent already running
  // in a folder Argo later spawned into stays external.
  const startedAtMs = firstInChain(logical.files, (file) => file.firstTimestampMs)
  const posture = context.managed.postureFor(cwd, startedAtMs)
  const nowMs = context.now()
  return toObservedSession(logical, posture, (agents) =>
    deriveSessionStatus({
      posture,
      processMatch: cwd !== null && cwds.has(cwd),
      lastTimestampMs: latestInChain(logical.files, (file) => file.lastTimestampMs),
      nowMs,
      agents,
    }),
  )
}

// The observer is the change detector, which is what lets the reducer replace unconditionally:
// an unchanged reading emits nothing, so the renderer never re-renders on a re-read.
async function publish(context: Context): Promise<void> {
  const cwds = await liveCwds(context, context.now())
  for (const logical of stitch([...context.byPath.values()])) {
    const observed = observe(context, logical, cwds)
    const reading = JSON.stringify(observed)
    if (context.published.get(observed.id) === reading) continue
    const created = !context.published.has(observed.id)
    context.published.set(observed.id, reading)
    context.hub.apply(created ? toSessionEvent(observed) : toSessionUpdate(observed))
  }
}

export function createObserver(hub: Hub, options: ObserverOptions): Observer {
  const context: Context = {
    hub,
    now: options.now ?? Date.now,
    managed: options.managed ?? createManagedSessions(),
    probeProcesses: options.probeProcesses ?? gatherClaudeProcesses,
    byPath: new Map(),
    published: new Map(),
    probed: { atMs: Number.NEGATIVE_INFINITY, cwds: new Set() },
  }
  let watcher: Watcher | null = null

  const refresh = async (path: string): Promise<void> => {
    await read(context, path)
    await publish(context)
  }

  return {
    refresh,
    managed: context.managed,
    async start() {
      try {
        const paths = await discoverWorkingSet(options.root, context.now())
        await Promise.all(paths.map((path) => read(context, path)))
        await publish(context)
      } catch {
        // A machine that never ran claude (no transcript root) is a clean no-op, not a crash.
      }
      if (options.watch !== false) {
        watcher = watchTranscripts(options.root, (path) => void refresh(path))
      }
    },
    stop() {
      watcher?.close()
      watcher = null
    },
  }
}
