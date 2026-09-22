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
import type { SessionService } from '@/domains/sessions/next/main/session-service'

export type ClaudeQueryFactory = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  cwd: string
  resume: string | undefined
  canUseTool: CanUseTool
  onUserDialog: OnUserDialog
}) => Query

export type ClaudeSessionInput = {
  session: SessionIdentity | null
  prompt: string
  cwd: string
  createQuery: ClaudeQueryFactory
  renameSession: (sessionId: string, title: string) => Promise<void>
  sessionService: SessionService
}

export type ClaudeSessionContext = {
  session: SessionIdentity | null
  sourceHealth: SourceHealth
  releaseTarget: 'closed' | 'unavailable' | 'watched'
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
  | { type: 'Session identified'; session: SessionIdentity }
  | { type: 'Channel restored' }
  | { type: 'Close' }
