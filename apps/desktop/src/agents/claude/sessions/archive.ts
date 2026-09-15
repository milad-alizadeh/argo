// Which Sessions the reader has archived. Argo holds no archive flag of its own: the Claude
// desktop app already keeps one per Session, and a second flag beside it would be a second answer
// to the same question. So the read below is a READING of that app's own store: a Session the
// store says nothing about is not archived.
//
// Bulk archive (#2194) needs a write too. Rather than open a second, Argo-owned store, the write
// below mutates the very same file in place: it changes only `isArchived` and carries every other
// key over untouched, so it stays the Claude desktop app's own record, not a second answer beside
// it. This is still a write into another app's undocumented format, grounded only in the shape
// this reader already parses (`cliSessionId`, `isArchived`) — a Session that has never gotten a
// file there at all comes back `failed` rather than inventing one.
//
// The store is one small JSON file per Session under the desktop app's support folder, and each
// file names the CLI Session it belongs to in `cliSessionId` — the id the transcripts are keyed
// by, so the two readings join on it. `sessionId` in the same file is the desktop app's own id and
// joins to nothing here.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { isRecord } from '../../../boundary'

// `<root>/<workspace>/<project>/local_<uuid>.json`, two levels down. The names are the desktop
// app's and neither is a fact this reader needs, so the tree is walked rather than addressed.
const DEPTH = 2

async function entriesIn(directory: string) {
  return await readdir(directory, { withFileTypes: true }).catch(() => [])
}

async function filesUnder(directory: string, depth: number): Promise<string[]> {
  const entries = await entriesIn(directory)
  const found: string[] = []
  for (const entry of entries) {
    const inside = path.join(directory, entry.name)
    if (entry.isDirectory() && depth > 0) found.push(...(await filesUnder(inside, depth - 1)))
    else if (entry.isFile() && entry.name.endsWith('.json')) found.push(inside)
  }
  return found
}

async function jsonRecordIn(file: string): Promise<Record<string, unknown> | null> {
  const text = await readFile(file, 'utf8').catch(() => null)
  if (text === null) return null
  try {
    const value: unknown = JSON.parse(text)
    return isRecord(value) ? value : null
  } catch {
    return null
  }
}

async function archivedIdIn(file: string): Promise<string | null> {
  const value = await jsonRecordIn(file)
  if (value === null || value.isArchived !== true) return null
  return typeof value.cliSessionId === 'string' ? value.cliSessionId : null
}

// The archived CLI Session ids in the store. A store that is not there at all — the desktop app
// was never installed — is no ids rather than a failure: the Roster is a reading of what this
// machine holds, and it holds no archive.
export async function readArchivedSessions(root: string): Promise<ReadonlySet<string>> {
  const files = await filesUnder(root, DEPTH)
  const ids = await Promise.all(files.map(archivedIdIn))
  return new Set(ids.filter((id): id is string => id !== null))
}

async function cliSessionIdIn(
  file: string,
): Promise<{ file: string; cliSessionId: string } | null> {
  const value = await jsonRecordIn(file)
  if (value === null || typeof value.cliSessionId !== 'string') return null
  return { file, cliSessionId: value.cliSessionId }
}

// Flips `isArchived` for each Session the caller names, on the file already keyed by its
// `cliSessionId` (or any id the Session has since retired — `targets` names every id a caller's
// Session has answered to, and the first match wins). Every other key in that file is read back
// and written out unchanged. A `target` whose ids match no file comes back in `failed`.
export async function writeArchivedSessionFlags(
  root: string,
  targets: readonly { id: string; candidateIds: readonly string[] }[],
  archived: boolean,
): Promise<{ applied: string[]; failed: string[] }> {
  const files = await filesUnder(root, DEPTH)
  const remaining = new Map(targets.map((target) => [target.id, new Set(target.candidateIds)]))
  const applied: string[] = []
  for (const file of files) {
    if (remaining.size === 0) break
    const record = await cliSessionIdIn(file)
    if (record === null) continue
    const match = [...remaining].find(([, candidateIds]) => candidateIds.has(record.cliSessionId))
    if (match === undefined) continue
    const [id] = match
    const text = await readFile(file, 'utf8')
    const value = JSON.parse(text) as Record<string, unknown>
    await writeFile(file, `${JSON.stringify({ ...value, isArchived: archived })}\n`)
    applied.push(id)
    remaining.delete(id)
  }
  return { applied, failed: [...remaining.keys()] }
}
