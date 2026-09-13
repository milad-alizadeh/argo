// Parsing a reply back into a known shape at the renderer's edge. The main process built these
// values, but the renderer's own boundary is the bridge, so it reads them the same way it reads
// anything from outside: once, into a shape, before anything draws them.
import { z } from 'zod'
import { guard, identifier, message } from '../contract/messages'
import {
  type ClaudeSessionStarted,
  type SessionFeedRead,
  type SessionFeedUnchanged,
  type SessionsListed,
  sessionErrorSchema,
} from './contract'
import { FEED_MARKERS, type SessionFeedRow } from './models'
import { rosterRow } from './roster-row-check'

const role = z.enum(['user', 'assistant'])

const feedRow: z.ZodType<SessionFeedRow> = z.discriminatedUnion('shape', [
  z.strictObject({ shape: z.literal('prose'), id: z.string(), role, text: z.string() }),
  z.strictObject({
    shape: z.literal('source'),
    id: z.string(),
    role,
    label: z.string(),
    source: z.string(),
  }),
  z.strictObject({ shape: z.literal('marker'), id: z.string(), marker: z.enum(FEED_MARKERS) }),
  z.strictObject({ shape: z.literal('thought'), id: z.string(), text: z.string() }),
  z.strictObject({ shape: z.literal('unreadable'), id: z.string() }),
])

const listed: z.ZodType<SessionsListed> = message('session.listed', {
  sessions: z.array(rosterRow),
  filesFound: z.number(),
  filesRead: z.number(),
  filesUnreadable: z.number(),
})

const feedIdentity = { sessionId: identifier, chainId: identifier, revision: z.string() }
const feedRead: z.ZodType<SessionFeedRead> = message('session.feed.read', {
  ...feedIdentity,
  rows: z.array(feedRow),
})
const feedUnchanged: z.ZodType<SessionFeedUnchanged> = message(
  'session.feed.unchanged',
  feedIdentity,
)

const started: z.ZodType<ClaudeSessionStarted> = message('session.claude.started', {
  sessionId: identifier,
})

export const isSessionListReply = guard(z.union([listed, sessionErrorSchema]))
export const isSessionFeedReply = guard(z.union([feedRead, feedUnchanged, sessionErrorSchema]))
export const isClaudeSessionStartReply = guard(z.union([started, sessionErrorSchema]))
