import { protocolString, type RequestID, type WireMessage } from '@/harnesses/codex/drive/protocol'

export type PendingCodexPermission = {
  id: string
  requestId: RequestID
  sessionId: string
  description: string
}

const APPROVAL_METHODS = new Set([
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
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
  }
}

export function codexApprovalDecision(decision: 'allow' | 'deny' | 'allowForSession' | 'cancel') {
  return { decision: decision === 'allow' || decision === 'allowForSession' ? 'accept' : 'decline' }
}
