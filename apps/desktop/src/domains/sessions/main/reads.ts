// Every Session read, one declaration each: the reply it answers with, how its target source is
// resolved, and its body. The failure modes, the absent-capability degrade and the reply envelope
// all sit behind the declaration, in `read-declaration.ts`. The two archive
// operations are declared in `archive-reads.ts`, because the flag they read is Argo's own.
import { readFile } from 'node:fs/promises'
import type { SessionChain } from '@/domains/sessions/contract/chains'
import type {
  SessionFileRequest,
  SessionShellOutputRequest,
  SessionSkillRequest,
  SessionSubagentUsageRequest,
} from '@/domains/sessions/contract/contract'
import type { SessionSource } from '@/harnesses/session/session-source'
import { fromNothing, fromOwner, MISSING_SESSION } from './read-declaration'
import { skillFileContent } from './read-skill-file'
import { fileInWorkspace } from './workspace-file'

// The workspace one Session ran in, as its last record named it.
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
  'session.subagent.usage.read',
  async (owner: SessionSource, request: SessionSubagentUsageRequest) => ({
    sessionId: request.sessionId,
    usage: (await owner.readSubagentUsage?.(request.sessionId)) ?? [],
  }),
)
