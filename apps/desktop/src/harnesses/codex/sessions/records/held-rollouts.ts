// Which Codex threads another Codex process has open right now (ADR-0040, CONTEXT.md L2 ·
// Session). Codex Desktop and the Codex TUI keep a thread's rollout file open for as long as the
// thread is open in them, Turn or no Turn, and `thread/resume` from a second app-server on such a
// thread fails. The open file table is the one place that fact is readable.
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { isLiveElsewhere } from '@/domains/sessions/main/lifecycle/status/live-elsewhere'
import { sessionIdFromFileName } from '../discovery/transcript-paths'

const run = promisify(execFile)

// Every file a process named `codex` holds on an ordinary descriptor, one `n<path>` line each.
const LSOF_ARGUMENTS = ['-F', 'n', '-c', 'codex', '-a', '-d', '0-999']
// 0.84 s for 31 open rollouts (macOS 26, 2026-09-18): far too slow for every roster read, so a
// listing serves for this long and refreshes behind the read that finds it stale.
const LISTING_LIFETIME_MS = 5000

export type OpenFileListing = () => Promise<string>

async function listOpenFiles(): Promise<string> {
  const { stdout } = await run('lsof', LSOF_ARGUMENTS, { maxBuffer: 16 * 1024 * 1024 })
  return stdout
}

// The thread ids named by the rollout files in one `lsof -F n` listing.
export function heldRolloutIds(listing: string): ReadonlySet<string> {
  const ids = listing
    .split('\n')
    .filter((line) => line.startsWith('n') && line.endsWith('.jsonl'))
    .map((line) => sessionIdFromFileName(path.basename(line.slice(1))))
  return new Set(ids)
}

// A listing that cannot be taken, on a host without `lsof` or with none of the processes, holds no
// thread rather than failing the roster read.
async function heldRollouts(list: OpenFileListing): Promise<ReadonlySet<string>> {
  try {
    return heldRolloutIds(await list())
  } catch {
    return new Set()
  }
}

export function createHeldRolloutReader(list: OpenFileListing = listOpenFiles) {
  let current: { at: number; ids: ReadonlySet<string> } | null = null
  let refreshing: Promise<ReadonlySet<string>> | null = null

  const refresh = (now: number) => {
    refreshing ??= heldRollouts(list).then((ids) => {
      current = { at: now, ids }
      refreshing = null
      return ids
    })
    return refreshing
  }

  return async (now: number): Promise<ReadonlySet<string>> => {
    if (current === null) return refresh(now)
    if (now - current.at >= LISTING_LIFETIME_MS) void refresh(now)
    return current.ids
  }
}

// Held is locked, not running: the other client may be idle on the thread, and the row's status
// stays whatever its rollout says.
export function joinHeldRollouts(
  rows: SessionRosterRow[],
  held: ReadonlySet<string>,
): SessionRosterRow[] {
  return rows.map((row) => (isLiveElsewhere(row, held) ? { ...row, locked: true } : row))
}
