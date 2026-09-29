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

// A relative path resolves against the workspace. An absolute path must already lie inside it.
export function fileInWorkspace(workspace: string, requested: string): string | null {
  const file = path.resolve(workspace, requested)
  const relative = path.relative(workspace, file)
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

// Lexical containment is not enough: a link inside the workspace can point outside it.
export async function readFileInWorkspace(
  workspace: string,
  requested: string,
): Promise<string | null> {
  const file = fileInWorkspace(workspace, requested)
  if (file === null) return null
  const [root, resolved] = await Promise.all([
    realpath(workspace).catch(() => null),
    realpath(file).catch(() => null),
  ])
  if (root === null || resolved === null) return null
  const relative = path.relative(root, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return readFile(resolved, 'utf8').catch(() => null)
}

async function workspaceFileContent(database: Database, sessionId: string, requested: string) {
  const session = database
    .select({ cwd: sessionTable.cwd })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  const workspace = session?.cwd
  return workspace === null || workspace === undefined
    ? null
    : readFileInWorkspace(workspace, requested)
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
        content: await workspaceFileContent(context.database, input.sessionId, input.path),
      })),
  }
}
