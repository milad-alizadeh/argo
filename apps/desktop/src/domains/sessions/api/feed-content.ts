import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

const base = z.strictObject({ id: identifierSchema })
export const mediaSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('url'), url: z.string().min(1) }),
  z.strictObject({ kind: z.literal('path'), path: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('data'),
    mimeType: z.string().min(1),
    base64: z.string().min(1),
  }),
])
export type MediaSource = z.infer<typeof mediaSourceSchema>

const contentPartSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('text'), text: z.string() }),
  z.strictObject({ kind: z.literal('image'), source: mediaSourceSchema }),
  z.strictObject({ kind: z.literal('audio'), source: mediaSourceSchema }),
  z.strictObject({ kind: z.literal('document'), source: mediaSourceSchema }),
  z.strictObject({ kind: z.literal('json'), value: z.json() }),
  z.strictObject({ kind: z.literal('encrypted'), bytes: z.string().min(1) }),
])

export const workStatusSchema = z.enum([
  'pending',
  'running',
  'paused',
  'completed',
  'failed',
  'interrupted',
])

export const toolPresentationKindSchema = z.enum([
  'command',
  'read',
  'edited',
  'created',
  'deleted',
  'tool',
  'skill',
  'searched',
])
export const toolPresentationSchema = z.strictObject({
  kind: toolPresentationKindSchema,
  label: z.string(),
  agentDescription: z.boolean().optional(),
})
export type ToolPresentation = z.infer<typeof toolPresentationSchema>

export const feedContentSchema = z.discriminatedUnion('kind', [
  base.extend({
    kind: z.literal('message'),
    role: z.enum(['user', 'assistant', 'system']),
    text: z.string(),
    phase: z.enum(['commentary', 'final_answer']).nullable().optional(),
  }),
  base.extend({ kind: z.literal('reasoning'), text: z.string().nullable(), redacted: z.boolean() }),
  base.extend({
    kind: z.literal('media'),
    mediaType: z.enum(['image', 'audio', 'document']),
    source: mediaSourceSchema,
    role: z.enum(['user', 'assistant']).nullable(),
  }),
  base.extend({
    kind: z.literal('reference'),
    referenceType: z.enum(['file', 'skill', 'mention', 'citation', 'memory', 'pasted']),
    label: z.string(),
    target: z.string().nullable(),
    text: z.string().nullable(),
  }),
  base.extend({
    kind: z.literal('tool'),
    callId: identifierSchema,
    name: z.string(),
    status: workStatusSchema,
    input: z.json().nullable(),
    output: z.array(contentPartSchema).nullable(),
    summary: z.string().nullable(),
    presentation: toolPresentationSchema.optional(),
  }),
  base.extend({
    kind: z.literal('command'),
    command: z.string().nullable(),
    cwd: z.string().nullable(),
    status: workStatusSchema,
    output: z.string().nullable(),
    stderr: z.string().nullable(),
    exitCode: z.number().int().nullable(),
  }),
  base.extend({
    kind: z.literal('fileChange'),
    status: workStatusSchema,
    changes: z.array(
      z.strictObject({
        path: z.string(),
        change: z.enum(['add', 'update', 'delete', 'unknown']),
        diff: z.string().nullable(),
      }),
    ),
  }),
  base.extend({
    kind: z.literal('search'),
    query: z.string(),
    action: z.string().nullable(),
    results: z.array(z.strictObject({ title: z.string(), source: z.string() })),
  }),
  base.extend({ kind: z.literal('plan'), text: z.string() }),
  base.extend({
    kind: z.literal('delegation'),
    agentId: identifierSchema,
    status: workStatusSchema,
    name: z.string().nullable(),
    prompt: z.string().nullable(),
    model: z.string().nullable(),
    summary: z.string().nullable(),
  }),
  base.extend({
    kind: z.literal('task'),
    taskId: identifierSchema,
    callId: identifierSchema.nullable(),
    status: workStatusSchema.nullable(),
    description: z.string().nullable(),
    summary: z.string().nullable(),
  }),
  base.extend({
    kind: z.literal('notification'),
    category: z.enum([
      'status',
      'info',
      'warning',
      'suggestion',
      'auth',
      'retry',
      'hook',
      'plugin',
      'system',
    ]),
    text: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'immediate']).nullable(),
  }),
  base.extend({
    kind: z.literal('context'),
    source: z.enum(['system', 'hook', 'memory', 'environment']),
    text: z.string(),
  }),
  base.extend({
    kind: z.literal('marker'),
    marker: z.enum([
      'compaction',
      'reviewStarted',
      'reviewEnded',
      'interrupted',
      'conversationReset',
    ]),
    summary: z.string().nullable(),
  }),
  base.extend({
    kind: z.literal('refusal'),
    reason: z.enum(['model', 'permission', 'fallback']),
    text: z.string().nullable(),
  }),
  base.extend({
    kind: z.literal('imageGeneration'),
    status: workStatusSchema,
    prompt: z.string().nullable(),
    source: mediaSourceSchema.nullable(),
    failure: z.string().nullable(),
  }),
  base.extend({ kind: z.literal('wait'), durationMs: z.number().int().nonnegative() }),
  base.extend({ kind: z.literal('diagnostic'), vendorType: z.string(), detail: z.string() }),
])

export type FeedContent = z.infer<typeof feedContentSchema>
export const feedContentKindSchema = z.enum(
  feedContentSchema.options.map((option) => option.shape.kind.value) as [
    FeedContent['kind'],
    ...FeedContent['kind'][],
  ],
)
