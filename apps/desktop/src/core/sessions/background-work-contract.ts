// What the two background-work reads carry (#1582): the output one Shell has written, and what
// each Subagent of a Session has spent. Both are asked for only while a reader is looking at the
// work rail, so neither rides the Roster or Feed reply.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionErrorSchema } from './session-error'

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

export const sessionShellOutputReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.shell.output.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  shellId: identifierSchema,
  // The tail of the recorded output, or null where the Shell recorded no output source at all.
  // An empty string is a source that exists and has written nothing yet, which is not the same.
  output: z.string().nullable(),
})
export type SessionShellOutputRead = z.infer<typeof sessionShellOutputReadSchema>

// What each Subagent of one Session has spent (#1582). The parent transcript records no usage
// for the work a Subagent does, so this is read from the Subagent's own transcript, and only
// while a reader is looking at the roster that draws it.
export const sessionDelegationUsageRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.delegation.usage'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionDelegationUsageRequest = z.infer<typeof sessionDelegationUsageRequestSchema>

export const sessionDelegationUsageReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.delegation.usage.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  // One entry per Subagent whose transcript was read, keyed by the call that spawned it. Each
  // fact is null where that transcript does not report it; no entry means no readable transcript.
  usage: z.array(
    z.strictObject({
      id: identifierSchema,
      tokens: z.number().nullable(),
      model: z.string().nullable(),
    }),
  ),
})
export type SessionDelegationUsageRead = z.infer<typeof sessionDelegationUsageReadSchema>

export const sessionShellOutputReplySchema = z.union([
  sessionShellOutputReadSchema,
  sessionErrorSchema,
])
export type SessionShellOutputReply = z.infer<typeof sessionShellOutputReplySchema>
export const sessionDelegationUsageReplySchema = z.union([
  sessionDelegationUsageReadSchema,
  sessionErrorSchema,
])
export type SessionDelegationUsageReply = z.infer<typeof sessionDelegationUsageReplySchema>
