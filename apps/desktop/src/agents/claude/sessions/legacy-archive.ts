// The former Claude desktop archive is read only for the #2351 one-time migration. Its layout
// and record shape belong to the Claude adapter; no later Session read calls this module.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { readJsonFile } from './json-file'

const STORE_DEPTH = 2
const legacyArchiveRecordSchema = z.object({
  cliSessionId: z.string(),
  isArchived: z.boolean(),
})

async function filesBelow(directory: string, depth: number): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of entries) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory() && depth > 0) files.push(...(await filesBelow(file, depth - 1)))
    if (entry.isFile() && entry.name.endsWith('.json')) files.push(file)
  }
  return files
}

async function archivedIdIn(file: string): Promise<string | null> {
  const record = await readJsonFile(file)
  const parsed = legacyArchiveRecordSchema.safeParse(record)
  return parsed.success && parsed.data.isArchived ? parsed.data.cliSessionId : null
}

export async function legacyArchivedSessionIds(root: string): Promise<ReadonlySet<string>> {
  const ids = await Promise.all((await filesBelow(root, STORE_DEPTH)).map(archivedIdIn))
  return new Set(ids.filter((id): id is string => id !== null))
}
