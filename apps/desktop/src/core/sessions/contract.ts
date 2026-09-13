// The two operations the renderer holds for observed Sessions, and the shapes both sides parse.
// Named operations only: the renderer never receives the IPC object or picks a channel.
import { z } from 'zod'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  guard,
  identifier,
  message,
} from '../contract/messages'
import type { SessionFeedRow, SessionRosterRow } from './models'

export const SESSION_LIST_CHANNEL = 'argo:session:list'
export const SESSION_FEED_CHANNEL = 'argo:session:feed'
export const SESSION_CLAUDE_START_CHANNEL = 'argo:session:claude:start'

const listRequest = message('session.list', {})
// `revision` is the document the renderer already holds, if any. This keeps an unchanged reply
// from leaving a reloaded or evicted deck without rows to draw.
const feedRequest = message('session.feed', {
  sessionId: identifier,
  revision: z.string().nullable(),
})
const claudeStartRequest = message('session.claude.start', {
  cwd: z.string().min(1),
  prompt: z.string().refine((prompt) => prompt.trim().length > 0),
})

export type SessionListRequest = z.infer<typeof listRequest>
export type SessionFeedRequest = z.infer<typeof feedRequest>
export type ClaudeSessionStartRequest = z.infer<typeof claudeStartRequest>

export type ClaudeSessionStarted = {
  version: 1
  type: 'session.claude.started'
  requestId: string
  sessionId: string
}

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

export const SESSION_ERRORS = {
  'missing-session': 'Argo cannot find this Session.',
  'invalid-request': 'The Session request is invalid.',
  'unsupported-version': 'This Session contract version is not supported.',
  'transcripts-unavailable': 'Argo cannot read the Claude transcript folder.',
  'access-denied': 'Argo cannot access these Sessions.',
  'internal-error': 'Argo could not read these Sessions.',
  'invalid-response': 'Argo received an invalid Session response.',
  'connection-lost': 'The connection to Argo was lost.',
  'cli-unavailable': 'Claude Code is not available. Run claude doctor to repair it.',
  'launch-failed': 'Argo could not start Claude Code.',
} as const

export type SessionErrorCode = keyof typeof SESSION_ERRORS
export type SessionError = ContractError<'session.error', SessionErrorCode>

export type SessionListReply = SessionsListed | SessionError
export type SessionFeedReply = SessionFeedRead | SessionFeedUnchanged | SessionError
export type ClaudeSessionStartReply = ClaudeSessionStarted | SessionError

export const sessionError = errorFactory('session.error', SESSION_ERRORS)
export const sessionErrorSchema = errorSchema('session.error', SESSION_ERRORS)

export const isSessionListRequest = guard(listRequest)
export const isSessionFeedRequest = guard(feedRequest)
export const isClaudeSessionStartRequest = guard(claudeStartRequest)
