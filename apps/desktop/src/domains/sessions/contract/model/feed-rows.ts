import { z } from 'zod'
import { questionSchema } from '@/domains/sessions/contract/drive/question'
import {
  BACKGROUND_STATES,
  SUBAGENT_EVENTS,
  TRANSCRIPT_EVENT_KINDS,
  type TranscriptEventKind,
} from '@/domains/sessions/contract/model/transcript'
import { identifierSchema } from '@/shared/validation'
import { feedImageUrlSchema } from './feed-images'

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

export const toolCallKindSchema = z.enum([
  'command',
  'read',
  'edited',
  'created',
  'deleted',
  'tool',
  'skill',
  'searched',
])

const toolCallSchema = z.strictObject({
  id: identifierSchema,
  kind: toolCallKindSchema,
  label: z.string(),
  // An Edit's line counts, the one tool call that states a size today.
  lineCounts: z
    .strictObject({
      added: z.number().int().nonnegative(),
      removed: z.number().int().nonnegative(),
    })
    .nullable(),
  status: z.enum(['succeeded', 'failed', 'running', 'interrupted']),
  evidence: toolEvidenceSchema,
  // The call's own raw text, read by a kind routed inline (a command's full text). Null for a
  // kind routed to the evidence panel, which reads the call through `evidence` instead.
  text: z.string().nullable(),
})

const toolRowSchema = toolCallSchema.extend({ shape: z.literal('tool') })

// What a Session is doing now, the words the roster and the Feed both draw (`SessionActivity`).
export const liveActivitySchema = z.strictObject({
  label: z.string(),
  // A `thought` is the Turn's latest reasoning headline, newer than any call it has made.
  kind: z.union([toolCallKindSchema, z.literal('thought')]),
  open: z.boolean(),
})
export type LiveActivity = z.infer<typeof liveActivitySchema>

const subagentRowSchema = z.strictObject({
  shape: z.literal('subagent'),
  id: identifierSchema,
  subagentId: identifierSchema,
  event: z.enum(SUBAGENT_EVENTS),
  // How a `responded` row ended; absent on the other two events.
  state: z.enum(BACKGROUND_STATES).optional(),
  // Each fact is absent where the harness does not give it, never a placeholder.
  name: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  tokens: z.number().int().nonnegative().optional(),
  text: z.string().optional(),
})

export const sessionFeedRowSchema = z.discriminatedUnion('shape', [
  toolRowSchema,
  z.strictObject({
    shape: z.literal('tool-group'),
    id: identifierSchema,
    label: z.string(),
    calls: z.array(toolRowSchema),
    // The Session's activity while the Turn runs, set by the renderer alone (`withHeadline`)
    // from the same fact the roster draws under the title.
    headline: liveActivitySchema.optional(),
  }),
  z.strictObject({
    shape: z.literal('prose'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    text: z.string(),
    // The images the same message carries, drawn inside its bubble; absent when there are none.
    images: z.array(feedImageUrlSchema).min(1).optional(),
    // The other files it attached, by absolute path; absent when there are none.
    files: z.array(z.string().startsWith('/')).min(1).optional(),
  }),
  z.strictObject({ shape: z.literal('thought'), id: identifierSchema, text: z.string() }),
  z.strictObject({ shape: z.literal('command-output'), id: identifierSchema, text: z.string() }),
  z.strictObject({
    shape: z.literal('event'),
    id: identifierSchema,
    event: feedEventKindSchema,
    text: z.string().nullable(),
    // The protocol update's own untranslated text, shown behind a closed disclosure for
    // diagnostics; absent for a harness event, which has none worth keeping.
    raw: z.string().nullable().optional(),
  }),
  subagentRowSchema,
  z.strictObject({
    shape: z.literal('marker'),
    id: identifierSchema,
    marker: feedMarkerSchema,
    summary: z.string().nullable(),
  }),
  z.strictObject({
    shape: z.literal('source'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    label: z.string(),
    source: z.string(),
  }),
  // An image the assistant or a tool result carried, drawn as the picture itself.
  z.strictObject({
    shape: z.literal('image'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
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
