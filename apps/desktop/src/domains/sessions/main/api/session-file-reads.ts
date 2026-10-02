import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { identifierSchema } from '@/shared/validation'

const t = initTRPC.create()
const contentSchema = z.strictObject({ content: z.string().nullable() })
const SKILL_FILE = 'SKILL.md'

export type SessionFileReadContext = { database: Database }

// A relative path resolves against the Session folder. An absolute path must already lie inside it.
export function fileInFolder(folder: string, requested: string): string | null {
  const file = path.resolve(folder, requested)
  const relative = path.relative(folder, file)
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : file
}

async function skillFile(requested: string) {
  if (!path.isAbsolute(requested) || path.basename(requested) !== SKILL_FILE) return null
  const resolved = await realpath(requested).catch(() => null)
  return resolved !== null && path.basename(resolved) === SKILL_FILE ? resolved : null
}

export async function skillFileContent(requested: string): Promise<string | null> {
  const file = await skillFile(requested)
  return file === null ? null : await readFile(file, 'utf8').catch(() => null)
}

// Lexical containment is not enough: a link inside the folder can point outside it.
export async function readFileInFolder(folder: string, requested: string): Promise<string | null> {
  const file = fileInFolder(folder, requested)
  if (file === null) return null
  const [root, resolved] = await Promise.all([
    realpath(folder).catch(() => null),
    realpath(file).catch(() => null),
  ])
  if (root === null || resolved === null) return null
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return readFile(resolved, 'utf8').catch(() => null)
}

async function sessionFolderFileContent(database: Database, sessionId: string, requested: string) {
  const session = database
    .select({ cwd: sessionTable.cwd })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  const folder = session?.cwd
  return folder === null || folder === undefined ? null : readFileInFolder(folder, requested)
}

export function sessionFileReadProcedures(context: SessionFileReadContext) {
  return {
    sessionSkillRead: t.procedure
      .input(z.strictObject({ path: z.string() }))
      .output(contentSchema)
      .query(async ({ input }) => ({ content: await skillFileContent(input.path) })),
    sessionWorkspaceFileRead: t.procedure
      .input(z.strictObject({ sessionId: identifierSchema, path: z.string() }))
      .output(contentSchema)
      .query(async ({ input }) => ({
        content: await sessionFolderFileContent(context.database, input.sessionId, input.path),
      })),
  }
}
