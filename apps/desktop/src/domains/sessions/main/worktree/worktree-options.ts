// What the composer's Worktree row offers a new Session: the Project's remembered switch, its main
// checkout and current branch, the local branches a new worktree can start from, and the default
// branch the Session header compares a worktree's base with.
import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { initTRPC, TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { projectSelectSchema } from '@/database/project/validation'
import { FALLBACK_DEFAULT_BRANCH } from '@/domains/sessions/api/worktree-request'
import {
  gitCommonDirectory,
  linkedWorktrees,
  mainWorktreePath,
  remoteDefaultBranch,
} from '@/platform/main/git-worktrees'
import { readWorktreeBranch } from './worktree-branch'
import { runGit } from './worktree-folder'

const t = initTRPC.create()

const inputSchema = z.strictObject({ projectId: projectSelectSchema.shape.id })
const optionsOutputSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('worktree.options'),
    requestId: z.uuid(),
    newWorktree: z.boolean(),
    checkout: z.strictObject({ path: z.string().min(1), branch: z.string().min(1).nullable() }),
    branches: z.array(z.string().min(1)),
    defaultBranch: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('worktree.error'),
    requestId: z.uuid(),
    code: z.literal('missing-project'),
  }),
])

export type WorktreeOptionsContext = {
  database: Database
  exclusive: <T>(work: () => Promise<T>) => Promise<T>
}

type LinkedWorktree = { path: string; branch: string | null }
type ProjectFolders = { main: string; linked: LinkedWorktree[] }

// The main checkout and every linked worktree git lists, by real path. Reads files, never runs git.
export async function projectFolders(projectPath: string): Promise<ProjectFolders> {
  const common = await gitCommonDirectory(projectPath)
  const main = mainWorktreePath(common) ?? projectPath
  const resolvedMain = await realpath(main).catch(() => main)
  const linked = new Map<string, LinkedWorktree>()
  for (const candidate of await linkedWorktrees(common)) {
    // A worktree deleted without `git worktree prune` still has its gitdir entry.
    const resolved = await realpath(candidate.path).catch(() => null)
    if (resolved !== null && resolved !== resolvedMain)
      linked.set(resolved, { path: resolved, branch: candidate.branch })
  }
  return { main: resolvedMain, linked: [...linked.values()] }
}

// The Project's main checkout, or null for a Project that is not registered.
export async function mainCheckout(database: Database, projectId: string): Promise<string | null> {
  const registered = database
    .select({ path: project.path })
    .from(project)
    .where(eq(project.id, projectId))
    .get()
  return registered === undefined ? null : (await projectFolders(registered.path)).main
}

// Local branches, the most recently committed first.
async function localBranches(checkout: string): Promise<string[]> {
  const listed = await runGit([
    '-C',
    checkout,
    'for-each-ref',
    '--sort=-committerdate',
    '--format=%(refname:short)',
    'refs/heads',
  ]).catch(() => ({ stdout: '' }))
  return listed.stdout.split('\n').filter((branch) => branch !== '')
}

function readProject(database: Database, projectId: string) {
  return projectSelectSchema
    .pick({ id: true, path: true })
    .extend({ newWorktree: z.boolean() })
    .safeParse(
      database
        .select({ id: project.id, path: project.path, newWorktree: project.newWorktree })
        .from(project)
        .where(eq(project.id, projectId))
        .get(),
    )
}

async function readOptions(
  database: Database,
  projectId: string,
): Promise<z.infer<typeof optionsOutputSchema>> {
  const requestId = randomUUID()
  const registered = readProject(database, projectId)
  if (!registered.success) return { type: 'worktree.error', requestId, code: 'missing-project' }
  const { main } = await projectFolders(registered.data.path)
  const common = await gitCommonDirectory(registered.data.path)
  return {
    type: 'worktree.options',
    requestId,
    newWorktree: registered.data.newWorktree,
    checkout: { path: main, branch: await readWorktreeBranch(main) },
    branches: await localBranches(main),
    defaultBranch: (await remoteDefaultBranch(common)) ?? FALLBACK_DEFAULT_BRANCH,
  }
}

export function worktreeOptionsProcedure(context: WorktreeOptionsContext) {
  return t.procedure
    .input(inputSchema)
    .output(optionsOutputSchema)
    .query(({ input }) => context.exclusive(() => readOptions(context.database, input.projectId)))
}

// The Worktree switch, remembered for the Project. The start branch is never remembered.
export function worktreeSwitchProcedure(context: WorktreeOptionsContext) {
  return t.procedure
    .input(inputSchema.extend({ newWorktree: z.boolean() }))
    .output(z.strictObject({ newWorktree: z.boolean() }))
    .mutation(({ input }) =>
      context.exclusive(async () => {
        const registered = readProject(context.database, input.projectId)
        if (!registered.success)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-project' })
        context.database
          .update(project)
          .set({ newWorktree: input.newWorktree })
          .where(eq(project.id, input.projectId))
          .run()
        return { newWorktree: input.newWorktree }
      }),
    )
}
