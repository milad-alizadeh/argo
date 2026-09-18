import { z } from 'zod'
import { identifierSchema } from '@/boundary'
import { questionAnswerSchema, questionSchema } from './question'

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

// `AskUserQuestion` questions and their answers are the CLI-neutral Question/QuestionAnswer
// shape (./question, #1841) under Claude's own names, since Claude's tool call already produces
// that shape verbatim (several questions in one call are answered top to bottom, per
// docs/designs/cockpit-feed-ask.md).
export const claudeQuestionSchema = questionSchema
export type ClaudeQuestion = z.infer<typeof claudeQuestionSchema>

export const claudeQuestionAnswerSchema = questionAnswerSchema
export type ClaudeQuestionAnswer = z.infer<typeof claudeQuestionAnswerSchema>
