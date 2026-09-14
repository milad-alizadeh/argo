// One JSON document under `<userData>/portable-v1`, read and replaced whole. Every store the
// cockpit owns goes through here, so each gets the same atomic write and the same three failures.
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isRecord } from '../../boundary'

export type DocumentRead =
  | { ok: true; document: unknown }
  // `missing` is a fresh installation and `unreadable` is a real storage failure. A caller that
  // has to tell an empty cockpit from a broken one needs both, so they are not one reason.
  | { ok: false; reason: 'missing' | 'unreadable' | 'invalid' }

export function portablePath(userData: string, name: string): string {
  return path.join(userData, 'portable-v1', name)
}

export async function readDocument(documentPath: string): Promise<DocumentRead> {
  let content: string
  try {
    content = await readFile(documentPath, 'utf8')
  } catch (error) {
    const missing = isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    return { ok: false, reason: missing ? 'missing' : 'unreadable' }
  }
  try {
    return { ok: true, document: JSON.parse(content) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

// Replace the file through a rename, so an interrupted write leaves the previous document intact
// rather than a truncated one. `mode` is for a file only this user may read.
export async function writeDocument(
  documentPath: string,
  document: Record<string, unknown>,
  mode = 0o644,
): Promise<boolean> {
  const pending = `${documentPath}.${randomUUID()}.pending`
  try {
    await mkdir(path.dirname(documentPath), { recursive: true })
    await writeFile(pending, `${JSON.stringify(document, null, 2)}\n`, { mode })
    await rename(pending, documentPath)
    return true
  } catch {
    await rm(pending, { force: true }).catch(() => undefined)
    return false
  }
}

// The synchronous twin of `readDocument`/`writeDocument`, for the one caller that reads and saves
// from a signal handler and a hot poll path where an `await` cannot fit: the Session ownership
// ledger. Same shape, same atomic rename, same three failures.
export function readDocumentSync(documentPath: string): DocumentRead {
  let content: string
  try {
    content = readFileSync(documentPath, 'utf8')
  } catch (error) {
    const missing = isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    return { ok: false, reason: missing ? 'missing' : 'unreadable' }
  }
  try {
    return { ok: true, document: JSON.parse(content) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function writeDocumentSync(
  documentPath: string,
  document: Record<string, unknown>,
  mode = 0o644,
): boolean {
  const pending = `${documentPath}.${randomUUID()}.pending`
  try {
    mkdirSync(path.dirname(documentPath), { recursive: true })
    writeFileSync(pending, `${JSON.stringify(document, null, 2)}\n`, { mode })
    renameSync(pending, documentPath)
    return true
  } catch {
    try {
      rmSync(pending, { force: true })
    } catch {
      // Best effort: the pending file, if it exists at all, is orphaned but harmless.
    }
    return false
  }
}

// Fields a document holds that this build does not own. Another portable client may own them, and
// a write must not delete them (docs/portable-integration-contracts.md).
export function otherFields(document: unknown, owned: string[]): Record<string, unknown> {
  if (!isRecord(document)) return {}
  return Object.fromEntries(Object.entries(document).filter(([key]) => !owned.includes(key)))
}

// Every write to one store's files goes through here, one at a time: two IPC calls reading the
// same document and writing it back would otherwise lose the first one's change.
export function createWriteQueue(): <T>(work: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  return (work) => {
    const run = tail.then(work, work)
    tail = run.catch(() => undefined)
    return run
  }
}
