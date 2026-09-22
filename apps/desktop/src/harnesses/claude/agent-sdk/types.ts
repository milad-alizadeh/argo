import type {
  CanUseTool,
  OnUserDialog,
  Query,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type {
  SessionIdentity,
  SourceHealth,
} from '@/domains/sessions/next/contract/session-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'

const sessionMessageSchema = z.looseObject({
  session_id: z.string().min(1),
  type: z.string().min(1),
})

const systemMessageSchema = sessionMessageSchema.extend({
  type: z.literal('system'),
  subtype: z.string().min(1),
})

const assistantMessageSchema = sessionMessageSchema.extend({
  type: z.literal('assistant'),
  error: z
    .enum([
      'authentication_failed',
      'oauth_org_not_allowed',
      'account_on_hold',
      'verification_required',
      'billing_error',
      'rate_limit',
      'overloaded',
      'invalid_request',
      'model_not_found',
      'server_error',
      'unknown',
      'max_output_tokens',
      'cloud_credential_error',
    ])
    .optional(),
})

const otherMessageSchema = sessionMessageSchema.refine(
  (message) => message.type !== 'system' && message.type !== 'assistant',
)

export const claudeSdkMessageSchema = z.union([
  systemMessageSchema,
  assistantMessageSchema,
  otherMessageSchema,
])
export type ClaudeSdkMessage = z.infer<typeof claudeSdkMessageSchema>

export type ClaudeQueryFactory = (params: {
  prompt: AsyncIterable<SDKUserMessage>
  cwd: string
  resume: string | undefined
  canUseTool: CanUseTool
  onUserDialog: OnUserDialog
}) => Query

export type ClaudeSessionInput = {
  session: SessionIdentity | null
  workspaceId: string
  prompt: string
  cwd: string
  createQuery: ClaudeQueryFactory
  renameSession: (sessionId: string, title: string) => Promise<void>
  sessionService: SessionService
}

export type ClaudeSessionContext = {
  session: SessionIdentity | null
  workspaceId: string
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
  | { type: 'SDK message'; message: ClaudeSdkMessage }
  | { type: 'SDK ended' }
  | { type: 'SDK failed' }
  | { type: 'Channel lost' }
  | { type: 'Session identified'; session: SessionIdentity }
  | { type: 'Channel restored' }
  | { type: 'Close' }
