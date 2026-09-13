import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const FEED_MARKERS = ['compacted', 'interrupted'] as const
export const feedMarkerSchema = z.enum(FEED_MARKERS)
export type FeedMarker = z.infer<typeof feedMarkerSchema>

const toolEvidenceSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('output'), title: z.string(), source: z.string() }),
    z.strictObject({ kind: z.literal('document'), title: z.string(), source: z.string() }),
    z.strictObject({ kind: z.literal('diff'), title: z.string(), source: z.string() }),
  ])
  .nullable()

const toolCallSchema = z.strictObject({
  id: identifierSchema,
  kind: z.enum(['command', 'read', 'edited', 'created', 'tool']),
  label: z.string(),
  detail: z.string().nullable(),
  status: z.enum(['succeeded', 'failed', 'running']),
  evidence: toolEvidenceSchema,
})

const toolRowSchema = toolCallSchema.extend({ shape: z.literal('tool') })

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
  z.strictObject({ shape: z.literal('marker'), id: identifierSchema, marker: feedMarkerSchema }),
  z.strictObject({
    shape: z.literal('source'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    label: z.string(),
    source: z.string(),
  }),
  z.strictObject({ shape: z.literal('unreadable'), id: identifierSchema }),
])
export type SessionFeedRow = z.infer<typeof sessionFeedRowSchema>

export const UNREADABLE_ROW = { paddingBlock: 4, itemHeight: 36 }

export function unreadableRowHeight(): number {
  return UNREADABLE_ROW.paddingBlock * 2 + UNREADABLE_ROW.itemHeight
}
