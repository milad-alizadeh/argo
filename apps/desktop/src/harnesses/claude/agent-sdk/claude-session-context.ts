import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import type { ClaudeSdkMessage, ClaudeSessionContext, ClaudeSessionInput } from './types'

export const initialClaudeSessionContext = (input: ClaudeSessionInput): ClaudeSessionContext => ({
  session: input.session,
  workspaceId: input.workspaceId,
  prompt: input.prompt,
  cwd: input.cwd,
  startedAt: input.startedAt,
  liveMessages: [],
  pendingApprovals: [],
  pendingQuestions: [],
  sourceHealth: 'ready',
  releaseTarget: 'closed',
})

export function sessionFrom(message: ClaudeSdkMessage): SessionIdentity | null {
  if (message.type !== 'system' || message.subtype !== 'init') return null
  return { harness: 'claude', nativeId: message.session_id }
}
