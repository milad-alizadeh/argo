import { z } from 'zod'
import { identifierSchema } from '../../../shared/validation'
import { validateSetupDocument } from './setup-document-validation'

export { SETUP_RENDERER_CAPABILITIES } from './setup-document-validation'

const setupFieldBaseSchema = z.object({
  id: identifierSchema,
  required: z.boolean().optional().default(false),
  configurationPath: z
    .array(
      z
        .string()
        .min(1)
        .refine(
          (segment) => !['__proto__', 'constructor', 'prototype'].includes(segment),
          'Configuration paths cannot contain reserved properties.',
        ),
    )
    .min(1),
})

const textFieldSchema = setupFieldBaseSchema.extend({
  type: z.literal('text'),
  recommendation: z.string().optional(),
  value: z.string().optional(),
})

const choiceSchema = z.object({ value: z.string().min(1) })

const choiceFieldSchema = setupFieldBaseSchema
  .extend({
    type: z.literal('choice'),
    choices: z.array(choiceSchema).min(1),
    recommendation: z.string().optional(),
    value: z.string().optional(),
  })
  .superRefine((field, context) => {
    const values = new Set(field.choices.map((choice) => choice.value))
    for (const [name, value] of [
      ['recommendation', field.recommendation],
      ['value', field.value],
    ] as const) {
      if (value !== undefined && !values.has(value)) {
        context.addIssue({
          code: 'custom',
          message: `${name} must match a declared choice.`,
          path: [name],
        })
      }
    }
  })

const booleanFieldSchema = setupFieldBaseSchema.extend({
  type: z.literal('boolean'),
  recommendation: z.boolean().optional(),
  value: z.boolean().optional(),
})

export const setupFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  choiceFieldSchema,
  booleanFieldSchema,
])
export type SetupField = z.infer<typeof setupFieldSchema>

const localizedItemSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1).optional(),
  choices: z.record(z.string().min(1), z.string().min(1)).optional().default({}),
})

const setupLocaleSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  fields: z.record(identifierSchema, localizedItemSchema),
  plan: z.record(identifierSchema, localizedItemSchema),
})

const setupPlanItemSchema = z.object({
  id: identifierSchema,
  icon: z.enum(['folder', 'wrench', 'terminal']).optional(),
  fieldIds: z.array(identifierSchema).optional().default([]),
})

export const setupDocumentSchema = z
  .object({
    version: z.literal(1),
    requiredCapabilities: z.array(z.string().min(1)),
    revision: z.string().min(1),
    locales: z.record(z.string().min(1), setupLocaleSchema),
    fields: z.array(setupFieldSchema),
    configuration: z.record(z.string(), z.unknown()),
    plan: z.array(setupPlanItemSchema),
    progress: z
      .object({ current: z.number().int().nonnegative(), total: z.number().int().positive() })
      .refine(({ current, total }) => current <= total, 'progress current must not exceed total')
      .optional(),
  })
  .superRefine(validateSetupDocument)

export type SetupDocument = z.infer<typeof setupDocumentSchema>

export function parseSetupDocument(value: unknown): SetupDocument {
  return setupDocumentSchema.parse(value)
}
