import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const CLAUDE_MODELS = ['fable', 'opus', 'sonnet', 'haiku'] as const
export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export const CLAUDE_MODES = [
  'manual',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const

export const claudeTurnSetupSchema = z.strictObject({
  model: z.enum(CLAUDE_MODELS),
  effort: z.enum(CLAUDE_EFFORTS),
  mode: z.enum(CLAUDE_MODES),
})
export type ClaudeTurnSetup = z.infer<typeof claudeTurnSetupSchema>

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>

export const claudeQuestionOptionSchema = z.strictObject({
  label: z.string().min(1),
  description: z.string().nullable(),
})
export type ClaudeQuestionOption = z.infer<typeof claudeQuestionOptionSchema>

// One `AskUserQuestion` question, verbatim off the tool call's own input (CONTEXT.md L2 · asking).
export const claudeQuestionSchema = z.strictObject({
  question: z.string().min(1),
  header: z.string().nullable(),
  multiSelect: z.boolean(),
  options: z.array(claudeQuestionOptionSchema).min(1),
})
export type ClaudeQuestion = z.infer<typeof claudeQuestionSchema>

// An answer to one question, in the same order the call asked them (several questions in one
// call are answered top to bottom, per docs/designs/cockpit-feed-ask.md). `index` counts every
// row the CLI's own picker draws, 1-based: the offered options, then one more row for
// "Type something." — so a free-text answer still names a row position, not a bare choice.
export const claudeQuestionAnswerSchema = z.discriminatedUnion('kind', [
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
export type ClaudeQuestionAnswer = z.infer<typeof claudeQuestionAnswerSchema>
