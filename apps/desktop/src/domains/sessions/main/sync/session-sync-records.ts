import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import type { SessionWorktree } from '@/database/session/validation'
import { sessionSubagent } from '@/database/session-subagent/schema'
import type { SessionSubagentLink, SessionSummary } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
import { createSessionUpsert, saveDiscoveredSessionSubagents } from '../database'
import { projectFolders } from '../worktree'

// `worktree` is a linked worktree git lists, other than the folder the Project was added from.
export type SessionRoot = {
  projectId: string
  path: string
  worktree: Omit<SessionWorktree, 'base'> | null
}

function contains(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..')
}

function matchRoot(roots: readonly SessionRoot[], cwd: string): SessionRoot | null {
  return (
    roots
      .filter((root) => contains(root.path, cwd))
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  )
}

export function knownSessionIds(database: Database, harness: Harness): string[] {
  return database
    .select({ nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(eq(sessionTable.harness, harness))
    .all()
    .map((row) => row.nativeId)
}

// Subagents already saved, under a parent or none, so discovery need not look their parent up.
export function knownSubagentIds(database: Database, harness: Harness): string[] {
  return database
    .select({ nativeId: sessionSubagent.nativeId })
    .from(sessionSubagent)
    .where(eq(sessionSubagent.harness, harness))
    .all()
    .map((row) => row.nativeId)
}

// Each Project's own folder, its main checkout and every linked worktree git lists for it. Read once
// per sync: it reads every Project's `.git` layout.
export async function sessionRoots(database: Database): Promise<SessionRoot[]> {
  const projects = database.select({ id: project.id, path: project.path }).from(project).all()
  const perProject = await Promise.all(
    projects.map(async (candidate): Promise<SessionRoot[]> => {
      const [folders, own] = await Promise.all([
        projectFolders(candidate.path),
        realpath(candidate.path).catch(() => candidate.path),
      ])
      return [
        { projectId: candidate.id, path: candidate.path, worktree: null },
        { projectId: candidate.id, path: folders.main, worktree: null },
        ...folders.linked.map((linked) => ({
          projectId: candidate.id,
          path: linked.path,
          worktree: linked.path === own ? null : linked,
        })),
      ]
    }),
  )
  // A Session's own worktree keeps its Project after the folder is gone, so a resume can move it.
  const worktrees = database
    .select({ projectId: sessionTable.projectId, path: sessionTable.worktreePath })
    .from(sessionTable)
    .where(and(isNotNull(sessionTable.projectId), isNotNull(sessionTable.worktreePath)))
    .all()
    .flatMap((row) =>
      row.projectId !== null && row.path !== null
        ? [{ projectId: row.projectId, path: row.path, worktree: null }]
        : [],
    )
  return [...perProject.flat(), ...worktrees]
}

// Git lists real paths, so a cwd under a symlink such as macOS's /var matches by its real path too.
// A Session in a linked worktree gets that worktree, whoever made it; any other match keeps the
// stored worktree, so a removed one stays until a resume moves the Session to the main checkout.
async function withProjectMatch(
  roots: readonly SessionRoot[],
  record: SessionSummary,
): Promise<SessionSummary> {
  if (record.cwd == null) return record
  const cwd = record.cwd
  const root = matchRoot(roots, cwd) ?? matchRoot(roots, await realpath(cwd).catch(() => cwd))
  const matched = { ...record, projectId: root?.projectId ?? null }
  if (root?.worktree == null) return matched
  return { ...matched, worktreePath: root.worktree.path, worktreeBranch: root.worktree.branch }
}

export function matchSessionsToProjects(
  roots: readonly SessionRoot[],
  records: readonly SessionSummary[],
): Promise<SessionSummary[]> {
  return Promise.all(records.map((record) => withProjectMatch(roots, record)))
}

function sessionRows(database: Database, harness: Harness, nativeIds: readonly string[]) {
  if (nativeIds.length === 0) return []
  return database
    .select({ argoId: sessionTable.argoId, nativeId: sessionTable.nativeId })
    .from(sessionTable)
    .where(and(eq(sessionTable.harness, harness), inArray(sessionTable.nativeId, [...nativeIds])))
    .all()
}

// Saves each Subagent under its saved parent, or under none. Returns the Sessions whose reads changed.
function saveSubagents(
  database: Database,
  harness: Harness,
  subagents: readonly SessionSubagentLink[],
): string[] {
  const parentNativeIds = subagents.flatMap(({ parentNativeId }) =>
    parentNativeId === null ? [] : [parentNativeId],
  )
  const parentIds = new Map(
    sessionRows(database, harness, parentNativeIds).map((row) => [row.nativeId, row.argoId]),
  )
  const saved = saveDiscoveredSessionSubagents(
    database,
    harness,
    subagents.map(({ nativeId, parentNativeId }) => ({
      nativeId,
      parentSessionId: parentNativeId === null ? null : (parentIds.get(parentNativeId) ?? null),
    })),
  )
  const parents = saved.flatMap(({ parentSessionId }) =>
    parentSessionId === null ? [] : [parentSessionId],
  )
  // A saved Session newly found to be a subagent leaves the list, so its detail read changes too.
  const children = sessionRows(
    database,
    harness,
    saved.map(({ nativeId }) => nativeId),
  ).map(({ argoId }) => argoId)
  return [...new Set([...parents, ...children])]
}

export function saveSessionBatch(
  database: Database,
  {
    harness,
    records,
    subagents = [],
  }: {
    harness: Harness
    records: readonly SessionSummary[]
    subagents?: readonly SessionSubagentLink[]
  },
): string[] {
  const upsert = createSessionUpsert(database)
  database.$client.exec('BEGIN IMMEDIATE')
  try {
    const sessionIds = records.map((record) => upsert({ ...record, harness }))
    sessionIds.push(...saveSubagents(database, harness, subagents))
    database.$client.exec('COMMIT')
    return sessionIds
  } catch (error) {
    database.$client.exec('ROLLBACK')
    throw error
  }
}
