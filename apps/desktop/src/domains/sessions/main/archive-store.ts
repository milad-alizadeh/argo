// Which Sessions the reader has archived (#2315). Argo owns this flag: one document under
// `<userData>/portable-v1`, keyed by the CLI Session id, so archiving works for every harness,
// on a machine with no other agent app installed, and for a Session Argo has never discovered.
import { z } from 'zod'
import {
  createWriteQueue,
  portablePath,
  readDocument,
  writeDocument,
} from '../../../platform/main/storage/portable-file'

// The one place the document is named, so the app, the fixtures and the tests all read the file
// the app writes.
export function sessionArchivePath(userData: string): string {
  return portablePath(userData, 'session-archive.json')
}

// The entry's presence is the flag, and restoring removes it rather than writing a false one.
// `archivedAt` is the document's one fact about an entry: when the reader archived it.
const archivedSessionSchema = z.strictObject({ archivedAt: z.iso.datetime() })

const archiveDocumentSchema = z.record(z.string(), archivedSessionSchema)

export type SessionArchiveStore = {
  archivedIds: () => Promise<ReadonlySet<string>>
  // Every id a Session has answered to, so a Session archived under an id it has since retired
  // restores from the one the caller holds now.
  setArchived: (ids: readonly string[], archived: boolean) => Promise<boolean>
}

// A Session is archived under whichever id was current when the reader archived it, and a resume
// moves that id on. Both readings join the same way, so they share this one.
export function isArchivedSession(
  row: { id: string; retiredIds: readonly string[] },
  archived: ReadonlySet<string>,
): boolean {
  return archived.has(row.id) || row.retiredIds.some((id) => archived.has(id))
}

async function readArchive(path: string): Promise<Record<string, { archivedAt: string }>> {
  const read = await readDocument(path)
  if (!read.ok) return {}
  const parsed = archiveDocumentSchema.safeParse(read.document)
  return parsed.success ? parsed.data : {}
}

// A reader built for a fixture or a test of unrelated behaviour gets this rather than a file path.
export function createInMemorySessionArchiveStore(): SessionArchiveStore {
  const archived = new Set<string>()
  return {
    archivedIds: async () => new Set(archived),
    setArchived: async (ids, archive) => {
      for (const id of ids) {
        if (archive) archived.add(id)
        else archived.delete(id)
      }
      return true
    },
  }
}

export function createSessionArchiveStore(path: string): SessionArchiveStore {
  const enqueue = createWriteQueue()
  return {
    // Unqueued, unlike the write below: a rename is atomic, so the worst a read racing a write
    // sees is the document as it was one write ago.
    archivedIds: async () => new Set(Object.keys(await readArchive(path))),
    setArchived: (ids, archive) =>
      enqueue(async () => {
        const held = await readArchive(path)
        const archivedAt = new Date().toISOString()
        const added = Object.fromEntries(ids.map((id) => [id, { archivedAt }]))
        const kept = Object.fromEntries(Object.entries(held).filter(([id]) => !ids.includes(id)))
        return await writeDocument(path, archive ? { ...held, ...added } : kept)
      }),
  }
}
