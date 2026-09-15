import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { SessionChain } from './chains'
import type { SessionFileRead, SessionFileRequest } from './file-contract'

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

export async function readWorkspaceFile(
  chain: SessionChain,
  request: SessionFileRequest,
): Promise<SessionFileRead> {
  const workspace = workspaceOf(chain)
  const file = workspace === null ? null : fileInWorkspace(workspace, request.path)
  const content = file === null ? null : await readFile(file, 'utf8').catch(() => null)
  return { version: 1, type: 'session.file.read', requestId: request.requestId, content }
}
