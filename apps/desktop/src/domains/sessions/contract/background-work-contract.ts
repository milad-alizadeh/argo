// What the two background-work reads carry (#1582): the output one Shell has written, and what
// each Subagent of a Session has spent. Both are asked for only while a reader is looking at the
// work rail, so neither rides the Roster or Feed reply.
import { z } from 'zod'
import { sessionErrorSchema } from '@/domains/sessions/contract/session-error'
import { identifierSchema } from '@/shared/validation'

// What one background Shell has written so far, read from the file the CLI's own receipt named
// (#1582). The renderer asks for it by the Shell's call id, never by a path of its own.
export const sessionShellOutputRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.shell.output'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  shellId: identifierSchema,
})
export type SessionShellOutputRequest = z.infer<typeof sessionShellOutputRequestSchema>

// A harness declares whether it can supply a running Shell's output. `absent` is different from
// an empty tail: the former gives the reader no terminal to draw, while the latter is a terminal
// that has not received output yet.
export const sessionShellOutputSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('available'), tail: z.string() }),
  z.strictObject({ state: z.literal('absent') }),
])
export type SessionShellOutput = z.infer<typeof sessionShellOutputSchema>

export const sessionShellOutputReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.shell.output.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  shellId: identifierSchema,
  output: sessionShellOutputSchema,
})
export type SessionShellOutputRead = z.infer<typeof sessionShellOutputReadSchema>

// What each Subagent of one Session has spent (#1582). The parent transcript records no usage
// for the work a Subagent does, so this is read from the Subagent's own transcript, and only
// while a reader is looking at the roster that draws it.
export const sessionSubagentUsageRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.subagent.usage'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionSubagentUsageRequest = z.infer<typeof sessionSubagentUsageRequestSchema>

export const sessionSubagentUsageSchema = z.strictObject({
  id: identifierSchema,
  tokens: z.number().nullable(),
  model: z.string().nullable().optional(),
})
export type SessionSubagentUsage = z.infer<typeof sessionSubagentUsageSchema>
export type SubagentUsageFacts = Omit<SessionSubagentUsage, 'id'>

export const sessionSubagentUsageReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.subagent.usage.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  // One entry per Subagent whose transcript was read, keyed by the call that spawned it. Tokens
  // are null when absent. Model is absent when an adapter does not read it and null when unread.
  usage: z.array(sessionSubagentUsageSchema),
})
export type SessionSubagentUsageRead = z.infer<typeof sessionSubagentUsageReadSchema>

export const sessionShellOutputReplySchema = z.union([
  sessionShellOutputReadSchema,
  sessionErrorSchema,
])
export type SessionShellOutputReply = z.infer<typeof sessionShellOutputReplySchema>
export const sessionSubagentUsageReplySchema = z.union([
  sessionSubagentUsageReadSchema,
  sessionErrorSchema,
])
export type SessionSubagentUsageReply = z.infer<typeof sessionSubagentUsageReplySchema>
