import type { ManagedSession } from '@/harnesses/codex/drive/managed-session'
import {
  protocolRecord,
  protocolString,
  type RequestID,
  type WireMessage,
} from '@/harnesses/codex/drive/protocol/protocol'

export type PendingCodexPermission = {
  id: string
  requestId: RequestID
  sessionId: string
  description: string
  additionalPermissions: Record<string, unknown> | null
}

const APPROVAL_METHODS = new Set([
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/permissions/requestApproval',
])

export function readRequestApproval(message: WireMessage): PendingCodexPermission | undefined {
  if (!('method' in message) || message.id === undefined || !APPROVAL_METHODS.has(message.method))
    return undefined
  const sessionId = protocolString(message.params.threadId, 'Approval thread ID')
  const id = protocolString(message.params.itemId, 'Approval item ID')
  const reason = message.params.reason
  return {
    id,
    requestId: message.id,
    sessionId,
    description: typeof reason === 'string' && reason.length > 0 ? reason : message.method,
    additionalPermissions:
      message.method === 'item/permissions/requestApproval'
        ? protocolRecord(message.params.permissions, 'Additional permissions')
        : null,
  }
}

export function codexApprovalDecision(
  permission: PendingCodexPermission,
  decision: 'allow' | 'deny' | 'allowForSession' | 'cancel',
) {
  if (permission.additionalPermissions !== null) {
    return {
      permissions:
        decision === 'allow' || decision === 'allowForSession'
          ? permission.additionalPermissions
          : {},
      scope: decision === 'allowForSession' ? 'session' : 'turn',
    }
  }
  return { decision: decision === 'allow' || decision === 'allowForSession' ? 'accept' : 'decline' }
}

export function decidePendingPermission(
  session: ManagedSession | undefined,
  permissionId: string,
  decision: 'allow' | 'deny' | 'allowForSession' | 'cancel',
) {
  const pending = session?.pendingPermission
  if (!session || !pending || pending.id !== permissionId) return false
  session.channel.respond(pending.requestId, codexApprovalDecision(pending, decision))
  session.pendingPermission = null
  if (session.status === 'permission') session.status = 'running'
  return true
}
