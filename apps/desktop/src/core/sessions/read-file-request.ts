import { sessionError, sessionFileRequestSchema } from './contract'
import { versionFailure } from './read-request'
import { readWorkspaceFile } from './read-workspace-file'
import type { SessionSource } from './session-source'

export async function workspaceFileReply(
  ownerFor: (sessionId: string) => Promise<SessionSource | undefined>,
  value: unknown,
) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionFileRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const owner = await ownerFor(parsed.data.sessionId)
  const chain = owner === undefined ? null : await owner.readSessionFiles(parsed.data.sessionId)
  if (chain === null) return sessionError('missing-session', parsed.data.requestId)
  return readWorkspaceFile(chain, parsed.data)
}
