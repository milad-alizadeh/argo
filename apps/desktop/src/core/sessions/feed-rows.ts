import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { questionSchema } from './question'
import { TRANSCRIPT_EVENT_KINDS, type TranscriptEventKind } from './transcript'

export const FEED_MARKERS = ['compacted', 'interrupted'] as const
export const feedMarkerSchema = z.enum(FEED_MARKERS)
export type FeedMarker = z.infer<typeof feedMarkerSchema>

export { TRANSCRIPT_EVENT_KINDS as FEED_EVENT_KINDS }
export const feedEventKindSchema = z.enum(TRANSCRIPT_EVENT_KINDS)
export type FeedEventKind = TranscriptEventKind

const toolEvidenceSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('output'), title: z.string(), source: z.string() }),
    z.strictObject({ kind: z.literal('document'), title: z.string(), source: z.string() }),
    z.strictObject({ kind: z.literal('diff'), title: z.string(), source: z.string() }),
  ])
  .nullable()

const toolCallSchema = z.strictObject({
  id: identifierSchema,
  kind: z.enum(['command', 'read', 'edited', 'created', 'tool', 'skill']),
  label: z.string(),
  detail: z.string().nullable(),
  status: z.enum(['succeeded', 'failed', 'running']),
  evidence: toolEvidenceSchema,
  // The call's own raw text, read by a kind routed inline (a command's full text). Null for a
  // kind routed to the evidence panel, which reads the call through `evidence` instead.
  text: z.string().nullable(),
})

const toolRowSchema = toolCallSchema.extend({ shape: z.literal('tool') })

const delegationRowSchema = z.strictObject({
  shape: z.literal('delegation'),
  id: identifierSchema,
  actor: z.enum(['agent', 'shell']),
  action: z.string().nullable(),
  status: z.string().nullable(),
  progress: z.string().nullable(),
  groupId: identifierSchema.nullable(),
  callId: identifierSchema.nullable(),
})

const shellDelegationEntrySchema = delegationRowSchema.extend({
  actor: z.literal('shell'),
  groupId: identifierSchema,
})

const delegationGroupSchema = z
  .strictObject({
    shape: z.literal('delegation-group'),
    id: identifierSchema,
    actor: z.literal('shell'),
    groupId: identifierSchema,
    entries: z.array(shellDelegationEntrySchema).min(1),
  })
  .superRefine((group, context) => {
    group.entries.forEach((entry, index) => {
      if (entry.groupId !== group.groupId)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A Shell activity entry must use its enclosing group id.',
          path: ['entries', index, 'groupId'],
        })
    })
  })

export const sessionFeedRowSchema = z.discriminatedUnion('shape', [
  toolRowSchema,
  z.strictObject({
    shape: z.literal('tool-group'),
    id: identifierSchema,
    label: z.string(),
    calls: z.array(toolRowSchema),
  }),
  z.strictObject({
    shape: z.literal('prose'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    text: z.string(),
  }),
  z.strictObject({ shape: z.literal('thought'), id: identifierSchema, text: z.string() }),
  z.strictObject({ shape: z.literal('command-output'), id: identifierSchema, text: z.string() }),
  z.strictObject({
    shape: z.literal('event'),
    id: identifierSchema,
    event: feedEventKindSchema,
    text: z.string().nullable(),
  }),
  delegationRowSchema,
  delegationGroupSchema,
  z.strictObject({ shape: z.literal('marker'), id: identifierSchema, marker: feedMarkerSchema }),
  z.strictObject({
    shape: z.literal('source'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    label: z.string(),
    source: z.string(),
  }),
  z.strictObject({ shape: z.literal('unreadable'), id: identifierSchema }),
  z.strictObject({
    shape: z.literal('ask'),
    // The question call's own id, so a decision names exactly the call it answers.
    id: identifierSchema,
    questions: z.array(questionSchema).min(1),
    // The CLI's own answered-questions text, verbatim; null while the call is still pending.
    // Nothing here is summarised — a row that cannot show the CLI's own words shows none.
    answer: z.string().nullable(),
    // Why this row cannot be answered through the shared form (Codex's `isSecret`, #1841); null
    // when every question here has an honest answer in the shared Question shape.
    unsupported: z.string().nullable(),
  }),
])
export type SessionFeedRow = z.infer<typeof sessionFeedRowSchema>

export const UNREADABLE_ROW = { paddingBlock: 4, itemHeight: 36 }

export function unreadableRowHeight(): number {
  return UNREADABLE_ROW.paddingBlock * 2 + UNREADABLE_ROW.itemHeight
}
