import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import { liveActivitySchema } from '../feed-activity'
import {
  feedContentKindSchema,
  SUBAGENT_EVENTS,
  toolPresentationKindSchema,
  workStatusSchema,
} from '../feed-content'
import { questionSchema } from '../questions'
import { BACKGROUND_STATES } from './background-task-record'
import { feedImageUrlSchema } from './feed-images'

const FEED_MARKERS = ['compacted', 'interrupted'] as const
const feedMarkerSchema = z.enum(FEED_MARKERS)

const FEED_EVENT_KINDS = [
  'status',
  'transcript',
  'context',
  'command',
  'skill-invocation',
  'liveStatus',
  'liveFailure',
  ...feedContentKindSchema.exclude([
    'message',
    'reference',
    'tool',
    'command',
    'notification',
    'context',
    'marker',
  ]).options,
  'permission',
  'permissionGranted',
  'permissionDenied',
  'permissionCancelled',
] as const
const feedEventKindSchema = z.enum(FEED_EVENT_KINDS)

const toolEvidenceSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('output'), title: z.string(), source: z.string() }),
    z.strictObject({ kind: z.literal('document'), title: z.string(), source: z.string() }),
    z.strictObject({ kind: z.literal('diff'), title: z.string(), source: z.string() }),
  ])
  .nullable()

const toolCallKindSchema = toolPresentationKindSchema

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
  agentDescription: z.boolean().optional(),
  // The file a file-change call touched, so a group counts files rather than calls.
  file: z.string().optional(),
  evidence: toolEvidenceSchema,
  // The call's own raw text, read by a kind routed inline (a command's full text). Null for a
  // kind routed to the evidence panel, which reads the call through `evidence` instead.
  text: z.string().nullable(),
})

const toolRowSchema = toolCallSchema.extend({ shape: z.literal('tool') })

// What a Session is doing now, the words the Session List and the Feed both draw (`SessionActivity`).
export { type LiveActivity, liveActivitySchema } from '../feed-activity'

const subagentRowSchema = z.strictObject({
  shape: z.literal('subagent'),
  id: identifierSchema,
  subagentId: identifierSchema,
  event: z.enum(SUBAGENT_EVENTS),
  // How a `responded` row ended; absent on the other two events.
  state: z.enum(BACKGROUND_STATES).optional(),
  // Each fact is absent where the harness does not give it, never a placeholder.
  name: z.string().optional(),
  nickname: z.string().optional(),
  type: z.string().optional(),
  model: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  tokens: z.number().int().nonnegative().optional(),
  // What the parent sent on `started` or `messaged`, verbatim.
  prompt: z.string().optional(),
  // What the Subagent answered, on `responded` only.
  text: z.string().optional(),
})

export const sessionFeedRowSchema = z.discriminatedUnion('shape', [
  toolRowSchema,
  z.strictObject({
    shape: z.literal('tool-group'),
    id: identifierSchema,
    label: z.string(),
    calls: z.array(toolRowSchema),
    thoughts: z
      .array(
        z.strictObject({
          id: identifierSchema,
          text: z.string(),
          afterCallIndex: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
    // The Session's activity while the Turn runs (`withHeadline`), the same fact the Session List
    // draws under the title. Absent once the Turn settles.
    headline: liveActivitySchema.optional(),
  }),
  z.strictObject({
    shape: z.literal('prose'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    text: z.string(),
    pastedContent: z.array(z.strictObject({ id: z.string(), text: z.string() })).optional(),
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
    status: workStatusSchema.optional(),
    skill: z.strictObject({ name: z.string(), path: z.string().min(1) }).optional(),
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
    // The Harness's own answered-questions text, verbatim; null while the call is still pending.
    // Nothing here is summarised — a row that cannot show the Harness's own words shows none.
    answer: z.string().nullable(),
    // Why this row cannot be answered through the shared form (a secret answer, #1841); null
    // when every question here has an honest answer in the shared Question shape.
    unsupported: z.string().nullable(),
  }),
])
export type SessionFeedRow = z.infer<typeof sessionFeedRowSchema>

// A Turn status row reports the Session's state and carries no prompt or reply.
export function isLiveStatusRow(row: SessionFeedRow): boolean {
  return row.shape === 'event' && row.event === 'liveStatus'
}
