import type {
  CanUseTool,
  OnUserDialog,
  Query,
  SDKMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type {
  SessionIdentity,
  SourceHealth,
} from '@/domains/sessions/next/contract/session-contract'

export type ClaudeQueryFactory = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  cwd: string
  canUseTool: CanUseTool
  onUserDialog: OnUserDialog
}) => Query

export type ClaudeSessionInput = {
  session: SessionIdentity
  prompt: string
  cwd: string
  createQuery: ClaudeQueryFactory
  renameSession: (sessionId: string, title: string) => Promise<void>
}

export type ClaudeSessionContext = {
  session: SessionIdentity
  sourceHealth: SourceHealth
}

export type ClaudeSessionEvent =
  | { type: 'Send'; prompt: string }
  | { type: 'Steer'; prompt: string }
  | { type: 'Interrupt' }
  | { type: 'Decide'; approvalId: string; decision: 'approve' | 'reject' }
  | { type: 'Answer'; questionId: string; answer: string }
  | { type: 'Rename'; title: string }
  | { type: 'SDK message'; message: SDKMessage }
  | { type: 'SDK ended' }
  | { type: 'SDK failed' }
