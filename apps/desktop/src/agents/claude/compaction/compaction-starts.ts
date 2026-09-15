import { readdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { identifierSchema } from '@/boundary'

// One compaction the hook saw start: the file's write time is when it started.
export type CompactionStart = { sessionId: string; startedAt: string; file: string }

const hookInputSchema = z.object({ session_id: identifierSchema })

async function readStart(file: string): Promise<CompactionStart | null> {
  try {
    const [content, written] = await Promise.all([readFile(file, 'utf8'), stat(file)])
    const parsed = hookInputSchema.safeParse(JSON.parse(content))
    if (!parsed.success) return null
    return { sessionId: parsed.data.session_id, startedAt: written.mtime.toISOString(), file }
  } catch {
    return null
  }
}

export async function readCompactionStarts(folder: string): Promise<CompactionStart[]> {
  const names = await readdir(folder).catch(() => [])
  const markers = await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .map((name) => readStart(path.join(folder, name))),
  )
  return markers.filter((marker) => marker !== null)
}

export async function removeCompactionStart(marker: CompactionStart) {
  await rm(marker.file, { force: true }).catch(() => undefined)
}
