// The two operations the renderer holds for observed Sessions, and the shapes both sides parse.
// Named operations only: the renderer never receives the IPC object or picks a channel.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import type { SessionFeedRow, SessionRosterRow } from './models'
import type { SessionError } from './session-error'

export * from './contract-validation'
export * from './session-error'

export const SESSION_LIST_CHANNEL = 'argo:session:list'
export const SESSION_FEED_CHANNEL = 'argo:session:feed'
export const SESSION_CLAUDE_START_CHANNEL = 'argo:session:claude:start'
export const SESSION_CLAUDE_SEND_CHANNEL = 'argo:session:claude:send'
export const SESSION_CLAUDE_INTERRUPT_CHANNEL = 'argo:session:claude:interrupt'
export const SESSION_CLAUDE_PERMISSION_CHANNEL = 'argo:session:claude:permission'
export const SESSION_CLAUDE_PERMISSION_DECIDE_CHANNEL = 'argo:session:claude:permission:decide'

export const sessionListRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.list'),
  requestId: identifierSchema,
})
export type SessionListRequest = z.infer<typeof sessionListRequestSchema>
export const sessionFeedRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  // The document the renderer already holds, if any. This keeps an unchanged reply from leaving
  // a reloaded or evicted deck without rows to draw.
  revision: z.string().nullable(),
})
export type SessionFeedRequest = z.infer<typeof sessionFeedRequestSchema>

export const claudeSessionStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.start'),
  requestId: identifierSchema,
  cwd: z.string().min(1),
  prompt: z.string().refine((value) => value.trim().length > 0),
})
export type ClaudeSessionStartRequest = z.infer<typeof claudeSessionStartRequestSchema>

export const claudeSessionStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.started'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionStarted = z.infer<typeof claudeSessionStartedSchema>

export const claudeSessionSendRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.send'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  prompt: z.string().refine((value) => value.trim().length > 0),
})
export type ClaudeSessionSendRequest = z.infer<typeof claudeSessionSendRequestSchema>

export const claudeSessionInterruptRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.interrupt'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionInterruptRequest = z.infer<typeof claudeSessionInterruptRequestSchema>

export const claudeSessionAcceptedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.accepted'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionAccepted = z.infer<typeof claudeSessionAcceptedSchema>

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
export const claudeSessionPermissionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionPermissionRequest = z.infer<typeof claudeSessionPermissionRequestSchema>
export const claudeSessionPermissionReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permission: claudePermissionSchema.nullable(),
})
export type ClaudeSessionPermissionRead = z.infer<typeof claudeSessionPermissionReadSchema>
export const claudeSessionPermissionDecisionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission.decide'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permissionId: identifierSchema,
  decision: z.enum(['allow', 'deny']),
})
export type ClaudeSessionPermissionDecisionRequest = z.infer<
  typeof claudeSessionPermissionDecisionRequestSchema
>

export type SessionsListed = {
  version: 1
  type: 'session.listed'
  requestId: string
  sessions: SessionRosterRow[]
  // What the pass reached, stated rather than implied. A Roster that read 200 of 1,055 files
  // says so; one that silently showed 200 rows would read as the whole machine.
  filesFound: number
  filesRead: number
  filesUnreadable: number
}

export type SessionFeedRead = {
  version: 1
  type: 'session.feed.read'
  requestId: string
  // The id that was ASKED for, echoed so the caller can prove the reply is its own.
  sessionId: string
  // The Session that answered. A retired id follows the chain that took it, so this is not always
  // the id asked for (CONTEXT.md L2 · retired id). The renderer keys on the id it asked for; this
  // is here so a caller can tell that the two differ, and it is what the proofs assert against.
  chainId: string
  // A main-process token for the exact projected document this reply carries. A different
  // revision must be measured before its rows enter the viewport, even when ids stay the same.
  revision: string
  rows: SessionFeedRow[]
}

// The selected chain's file stamps did not move, so the main process returns this compact reply
// instead of copying an unchanged whole document over IPC on every observation pass.
export type SessionFeedUnchanged = {
  version: 1
  type: 'session.feed.unchanged'
  requestId: string
  sessionId: string
  chainId: string
  revision: string
}

export type SessionListReply = SessionsListed | SessionError
export type SessionFeedReply = SessionFeedRead | SessionFeedUnchanged | SessionError
export type ClaudeSessionStartReply = ClaudeSessionStarted | SessionError
export type ClaudeSessionSendReply = ClaudeSessionAccepted | SessionError
export type ClaudeSessionInterruptReply = ClaudeSessionAccepted | SessionError
export type ClaudeSessionPermissionReply = ClaudeSessionPermissionRead | SessionError
export type ClaudeSessionPermissionDecisionReply = ClaudeSessionAccepted | SessionError
