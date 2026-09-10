// Which Sessions the reader has archived. Argo holds no archive flag of its own: the Claude
// desktop app already keeps one per Session, and a second flag beside it would be a second answer
// to the same question. So this is a READING of that app's own store, and it is read-only
// (CONTEXT.md L1 · degrade down): a Session the store says nothing about is not archived.
//
// The store is one small JSON file per Session under the desktop app's support folder, and each
// file names the CLI Session it belongs to in `cliSessionId` — the id the transcripts are keyed
// by, so the two readings join on it. `sessionId` in the same file is the desktop app's own id and
// joins to nothing here.
import { readdir, readFile } from 'node:fs/promises'
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

async function archivedIdIn(file: string): Promise<string | null> {
  const text = await readFile(file, 'utf8').catch(() => null)
  if (text === null) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(value) || value.isArchived !== true) return null
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
