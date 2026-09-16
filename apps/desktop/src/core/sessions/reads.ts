// Every Session read, one declaration each: the reply it answers with, how its target source is
// resolved, and its body. The failure modes, the absent-capability degrade and the reply envelope
// all sit behind the declaration, in `read-declaration.ts`. The archive write is declared here
// too, because setting the flag resolves its target and degrades exactly as reading it does.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SessionChain } from './chains'
import type {
  SessionArchiveListRequest,
  SessionArchiveSetRequest,
  SessionDelegationUsageRequest,
  SessionFileRequest,
  SessionShellOutputRequest,
  SessionSkillRequest,
} from './contract'
import { fromCapability, fromNothing, fromOwner, MISSING_SESSION } from './read-declaration'
import { skillFileContent } from './read-skill-file'
import type { SessionSource } from './session-source'

// The workspace one Session ran in, as its last record named it. A path outside that workspace,
// or an absolute one, reads as nothing rather than reaching where the renderer may not look.
function workspaceOf(chain: SessionChain) {
  const record = chain.files
    .flatMap((file) => file.records)
    .findLast((candidate) =>
      candidate.kind === 'message'
        ? candidate.cwd !== null
        : candidate.kind === 'trace' && candidate.cwd !== null,
    )
  return record?.kind === 'message' || record?.kind === 'trace' ? (record.cwd ?? null) : null
}

function fileInWorkspace(workspace: string, relativePath: string) {
  if (path.isAbsolute(relativePath)) return null
  const file = path.resolve(workspace, relativePath)
  return path.relative(workspace, file).startsWith('..') ? null : file
}

export const workspaceFileRead = fromOwner(
  'session.file.read',
  async (owner: SessionSource, request: SessionFileRequest) => {
    const chain = await owner.readSessionFiles(request.sessionId)
    if (chain === null) return MISSING_SESSION
    const workspace = workspaceOf(chain)
    const file = workspace === null ? null : fileInWorkspace(workspace, request.path)
    return { content: file === null ? null : await readFile(file, 'utf8').catch(() => null) }
  },
)

// The renderer names an absolute path a prompt mentioned, so this read needs no Session at all.
export const skillFileRead = fromNothing(
  'session.skill.read',
  async (request: SessionSkillRequest) => ({ content: await skillFileContent(request.path) }),
)

// The two reads about a Session's background work (#1582): what one Shell has written, and what
// each Subagent spent. An adapter that records neither answers with nothing rather than an error.
export const shellOutputRead = fromOwner(
  'session.shell.output.read',
  async (owner: SessionSource, request: SessionShellOutputRequest) => ({
    sessionId: request.sessionId,
    shellId: request.shellId,
    output: (await owner.readShellOutput?.(request.sessionId, request.shellId)) ?? null,
  }),
)

export const delegationUsageRead = fromOwner(
  'session.delegation.usage.read',
  async (owner: SessionSource, request: SessionDelegationUsageRequest) => ({
    sessionId: request.sessionId,
    usage: (await owner.readDelegationUsage?.(request.sessionId)) ?? [],
  }),
)

export const archiveListRead = fromCapability(
  {
    name: 'session.archive.listed',
    capability: 'discoverArchivedSessions',
    absent: () => ({ sessions: [], nextCursor: null, restored: null }),
  },
  async (source, request: SessionArchiveListRequest) => {
    const page = await source.discoverArchivedSessions({
      cursor: request.cursor,
      restoreId: request.restoreId,
    })
    return { sessions: page.rows, nextCursor: page.nextCursor, restored: page.restored }
  },
)

// Setting the archived flag for one or more Sessions at once (#2194), against the same store the
// list above reads. Where no source keeps one, every requested id comes back failed.
export const archiveSetWrite = fromCapability(
  {
    name: 'session.archive.applied',
    capability: 'setArchived',
    absent: (request: SessionArchiveSetRequest) => ({
      archived: request.archived,
      applied: [] as string[],
      failed: [...request.sessionIds],
    }),
  },
  async (source, request: SessionArchiveSetRequest) => {
    const applied = await source.setArchived({
      ids: request.sessionIds,
      archived: request.archived,
    })
    return { archived: request.archived, applied: applied.applied, failed: applied.failed }
  },
)
