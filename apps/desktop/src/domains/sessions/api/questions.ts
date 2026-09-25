// The Harness-neutral Question every SessionDriveAdapter answers in (ADR-0024, #1841), mirroring
// permission.ts. A Question states only what shared code and the shared renderer need: the
// prompt, its options, and — when a Harness's own question shape has no honest answer in this type
// (Codex's `isSecret`) — a reason the Feed's `ask` row shows instead of a form.
import { z } from 'zod'

export const questionOptionSchema = z.strictObject({
  label: z.string().min(1),
  description: z.string().nullable(),
})
export type QuestionOption = z.infer<typeof questionOptionSchema>

// One question, verbatim off the Harness's own asked question (CONTEXT.md L2 · asking). `options` may
// be empty: a Harness can ask a pure free-text question with no offered choices at all.
export const questionSchema = z.strictObject({
  question: z.string().min(1),
  header: z.string().nullable(),
  multiSelect: z.boolean(),
  options: z.array(questionOptionSchema),
})
export type Question = z.infer<typeof questionSchema>

// An answer to one question, in the same order the call asked them. `index` counts every row the
// Harness's own picker draws, 1-based: the offered options, then one more row for "Type something." —
// so a free-text answer still names a row position, not a bare choice.
export const questionAnswerSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('options'),
    indices: z.array(z.number().int().positive()).min(1),
  }),
  z.strictObject({
    kind: z.literal('text'),
    index: z.number().int().positive(),
    text: z.string().min(1),
  }),
])
export type QuestionAnswer = z.infer<typeof questionAnswerSchema>
