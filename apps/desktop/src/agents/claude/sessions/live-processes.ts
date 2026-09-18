// Which Sessions a running `claude` holds right now. Claude Code writes one `<pid>.json` per live
// process under `~/.claude/sessions`, naming the Session it holds and whether it is `busy` or
// `idle`. This is a DERIVED reading of that file, read-only (CONTEXT.md L2 · Session status): a
// file whose process has gone, or a word outside the two, says nothing.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { SessionRosterRow, SessionStatus } from '@/domains/sessions/contract/models'
import { isLiveElsewhere } from '@/domains/sessions/main/live-elsewhere'
import { readJsonFile } from './json-file'

export type ProcessState = 'busy' | 'idle'

const processFileSchema = z.object({
  pid: z.number().int().positive(),
  sessionId: z.string().min(1),
  status: z.enum(['busy', 'idle']),
})

// `kill(pid, 0)` sends nothing: it only asks whether the pid exists. EPERM means it does, owned by
// someone else.
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error instanceof Error && 'code' in error && error.code === 'EPERM'
  }
}

async function stateIn(file: string): Promise<[string, ProcessState] | null> {
  const parsed = processFileSchema.safeParse(await readJsonFile(file))
  if (!parsed.success || !isAlive(parsed.data.pid)) return null
  return [parsed.data.sessionId, parsed.data.status]
}

// A folder that is not there, on a machine where `claude` never ran, is no live Sessions.
export async function readLiveProcesses(root: string): Promise<ReadonlyMap<string, ProcessState>> {
  const names = await readdir(root).catch(() => [])
  const states = await Promise.all(
    names.filter((name) => name.endsWith('.json')).map((name) => stateIn(path.join(root, name))),
  )
  return new Map(states.filter((state) => state !== null))
}

// A pending question outranks `busy`: the process is up, but the Session is waiting on the reader.
// An `idle` process only fills a floor that could not say anything itself.
function liveStatus(floor: SessionStatus, state: ProcessState): SessionStatus {
  switch (state) {
    case 'busy':
      return floor === 'asking' ? 'asking' : 'running'
    case 'idle':
      return floor === 'unknown' ? 'idle' : floor
  }
}

// A live `claude` holds its Session at its prompt as much as mid-Turn, so either state locks it.
export function lockLiveProcesses(
  rows: SessionRosterRow[],
  live: ReadonlyMap<string, ProcessState>,
): SessionRosterRow[] {
  return rows.map((row) => (isLiveElsewhere(row, live) ? { ...row, locked: true } : row))
}

// A resume can move a Session's id forward, so the process may name the stable id or a retired one.
export function joinLiveProcesses(
  rows: SessionRosterRow[],
  live: ReadonlyMap<string, ProcessState>,
): SessionRosterRow[] {
  return rows.map((row) => {
    const state = [row.id, ...row.retiredIds].map((id) => live.get(id)).find(Boolean)
    return state === undefined ? row : { ...row, status: liveStatus(row.status, state) }
  })
}
