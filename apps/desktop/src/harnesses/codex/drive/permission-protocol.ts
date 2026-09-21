import {
  protocolRecord,
  protocolString,
  type RequestID,
  type WireMessage,
} from '@/harnesses/codex/drive/protocol'

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
