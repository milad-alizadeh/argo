import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

// One step in a Subagent's life, as its adapter read it. `responded` alone carries an end state,
// and every fact is absent where the harness does not give it (CONTEXT.md L3 · Subagent).
export const SUBAGENT_EVENTS = ['started', 'messaged', 'responded'] as const

const base = z.strictObject({ id: identifierSchema })
const mediaSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('url'), url: z.string().min(1) }),
  z.strictObject({ kind: z.literal('path'), path: z.string().min(1) }),
  z.strictObject({
    kind: z.literal('data'),
    mimeType: z.string().min(1),
    base64: z.string().min(1),
  }),
])
export type MediaSource = z.infer<typeof mediaSourceSchema>

const promptFileSchema = z.strictObject({ label: z.string(), target: z.string() })
export type PromptFile = z.infer<typeof promptFileSchema>

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
const toolPresentationSchema = z.strictObject({
  kind: toolPresentationKindSchema,
  label: z.string(),
  agentDescription: z.boolean().optional(),
  // A command's full text, which the Feed shows above its output.
  text: z.string().optional(),
})
export type ToolPresentation = z.infer<typeof toolPresentationSchema>

export const feedContentSchema = z.discriminatedUnion('kind', [
  base.extend({
    kind: z.literal('message'),
    role: z.enum(['user', 'assistant']),
    text: z.string(),
    phase: z.enum(['commentary', 'final_answer']).nullable().optional(),
    // The images and files an authored prompt carried alongside its text, and any pasted-in
    // document text — folded in at decode time so one Turn's prompt draws as one row (#2884).
    images: z.array(mediaSourceSchema).min(1).optional(),
    files: z.array(promptFileSchema).min(1).optional(),
    pastedContent: z
      .array(z.strictObject({ id: identifierSchema, text: z.string() }))
      .min(1)
      .optional(),
  }),
  base.extend({ kind: z.literal('reasoning'), text: z.string() }),
  base.extend({
    kind: z.literal('media'),
    mediaType: z.enum(['image', 'audio', 'document']),
    source: mediaSourceSchema,
    role: z.enum(['user', 'assistant']).nullable(),
  }),
  base.extend({
    kind: z.literal('reference'),
    referenceType: z.enum(['file', 'skill', 'memory']),
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
    status: workStatusSchema,
    output: z.string().nullable(),
    stderr: z.string().nullable(),
  }),
  base.extend({
    kind: z.literal('fileChange'),
    status: workStatusSchema,
    changes: z.array(
      z.strictObject({
        path: z.string(),
        change: z.enum(['add', 'update', 'delete']),
        diff: z.string().nullable(),
        // Where an update left the file when it also renamed it.
        movedTo: z.string().optional(),
      }),
    ),
  }),
  base.extend({ kind: z.literal('plan'), text: z.string() }),
  base.extend({
    kind: z.literal('delegation'),
    // Which step of the Subagent's life this record is; each step keeps its own `id`.
    event: z.enum(SUBAGENT_EVENTS),
    agentId: identifierSchema,
    status: workStatusSchema,
    name: z.string().nullable(),
    // A name the Harness gave the Subagent itself, apart from its task; absent where it gives none.
    nickname: z.string().optional(),
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
  base.extend({ kind: z.literal('notification'), text: z.string() }),
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
  base.extend({ kind: z.literal('refusal'), text: z.string().nullable() }),
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
