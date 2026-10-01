// The folders a new Session can run in: a new owned worktree, the main checkout, or a linked
// worktree found on disk.
import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectSelectSchema } from '@/database/project/validation'
import { sessionTable } from '@/database/session/schema'
import {
  gitCommonDirectory,
  linkedWorktreePaths,
  mainWorktreePath,
} from '@/platform/main/git-worktrees'
import { readWorktreeBranch } from './worktree-branch'

const t = initTRPC.create()
const absolutePathSchema = z
  .string()
  .refine((value) => path.isAbsolute(value) && !value.includes('\0'))
export const worktreeChoiceSchema = z.union([
  z.literal('new'),
  z.literal('main'),
  absolutePathSchema,
])
export type WorktreeChoice = z.infer<typeof worktreeChoiceSchema>

const inputSchema = z.strictObject({ projectId: projectSelectSchema.shape.id })
const worktreeSummarySchema = z.strictObject({
  path: absolutePathSchema,
  main: z.boolean(),
  name: z.string().min(1),
  branch: z.string().min(1).nullable(),
})
const outputSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('worktree.listed'),
    requestId: z.uuid(),
    worktrees: z.array(worktreeSummarySchema),
    choice: worktreeChoiceSchema,
  }),
  z.strictObject({
    type: z.literal('worktree.error'),
    requestId: z.uuid(),
    code: z.literal('missing-project'),
  }),
])

export type WorktreeChoiceContext = {
  database: Database
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}

type ProjectFolders = { main: string; linked: string[] }

// The main checkout and every linked worktree git lists, by real path.
export async function projectFolders(projectPath: string): Promise<ProjectFolders> {
  const common = await gitCommonDirectory(projectPath)
  const main = mainWorktreePath(common) ?? projectPath
  const resolvedMain = await realpath(main).catch(() => main)
  const linked = new Set<string>()
  for (const candidate of await linkedWorktreePaths(common)) {
    // A worktree deleted without `git worktree prune` still has its gitdir entry.
    const resolved = await realpath(candidate).catch(() => null)
    if (resolved !== null && resolved !== resolvedMain) linked.add(resolved)
  }
  return { main: resolvedMain, linked: [...linked] }
}

// The folders a new Session may use: a worktree another Session owns is not offered.
export async function offeredFolders(
  database: Database,
  projectPath: string,
): Promise<ProjectFolders> {
  const folders = await projectFolders(projectPath)
  const owned = new Set(
    database
      .select({ path: sessionTable.worktreePath })
      .from(sessionTable)
      .where(eq(sessionTable.worktreeOwned, true))
      .all()
      .map((row) => row.path),
  )
  return { main: folders.main, linked: folders.linked.filter((linked) => !owned.has(linked)) }
}

function readProject(database: Database, projectId: string) {
  return projectSelectSchema
    .pick({ id: true, path: true })
    .extend({ lastWorktreeChoice: worktreeChoiceSchema.catch('new') })
    .safeParse(
      database
        .select({ id: project.id, path: project.path, lastWorktreeChoice: project.lastWorktreeChoice })
        .from(project)
        .where(eq(project.id, projectId))
        .get(),
    )
}

async function listWorktrees(
  input: { requestId: string; projectId: string },
  database: Database,
): Promise<z.infer<typeof outputSchema>> {
  const registered = readProject(database, input.projectId)
  if (!registered.success)
    return { type: 'worktree.error', requestId: input.requestId, code: 'missing-project' }
  const folders = await offeredFolders(database, registered.data.path)
  const choice = registered.data.lastWorktreeChoice
  const available = choice === 'new' || choice === 'main' || folders.linked.includes(choice)
  const summaries = [
    { path: folders.main, main: true },
    ...folders.linked.map((linked) => ({ path: linked, main: false })),
  ]
  return {
    type: 'worktree.listed',
    requestId: input.requestId,
    choice: available ? choice : 'new',
    worktrees: await Promise.all(
      summaries.map(async (summary) => ({
        ...summary,
        name: path.basename(summary.path) || summary.path,
        branch: await readWorktreeBranch(summary.path),
      })),
    ),
  }
}

export function worktreeListProcedure(context: WorktreeChoiceContext) {
  return t.procedure
    .input(inputSchema)
    .output(outputSchema)
    .query(({ input }) =>
      context.exclusive(() => listWorktrees({ requestId: randomUUID(), ...input }, context.database)),
    )
}

export function worktreeChooseProcedure(context: WorktreeChoiceContext) {
  return t.procedure
    .input(inputSchema.extend({ choice: worktreeChoiceSchema }))
    .output(z.strictObject({ choice: worktreeChoiceSchema }))
    .mutation(({ input }) =>
      context.exclusive(async () => {
        const registered = readProject(context.database, input.projectId)
        if (!registered.success)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-project' })
        if (input.choice !== 'new' && input.choice !== 'main') {
          const folders = await offeredFolders(context.database, registered.data.path)
          if (!folders.linked.includes(input.choice))
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'missing-worktree' })
        }
        context.database
          .update(project)
          .set({ lastWorktreeChoice: input.choice })
          .where(eq(project.id, input.projectId))
          .run()
        return { choice: input.choice }
      }),
    )
}
