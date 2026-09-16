// Renaming one Session, routed to the adapter that owns it. A CLI whose adapter cannot rename
// says so as a drive error rather than a silent no-op.
import { driveSessionError, isDriveCli, sessionError, sessionRenameRequestSchema } from './contract'
import type { OwnerFor } from './read-background-work'
import { versionFailure } from './read-request'

export async function renameReply(ownerFor: OwnerFor, value: unknown) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionRenameRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const owner = await ownerFor(parsed.data.sessionId)
  if (owner === undefined) return sessionError('missing-session', parsed.data.requestId)
  if (owner.rename === undefined) {
    const cli = isDriveCli(owner.cli) ? owner.cli : 'claude'
    return driveSessionError('not-drivable', cli, parsed.data.requestId)
  }
  return owner.rename(parsed.data)
}
