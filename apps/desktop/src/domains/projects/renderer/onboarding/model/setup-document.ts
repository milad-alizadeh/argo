// The onboarding wizard's setup document: schema, structural validation, locale text lookup
// and configuration-file merging for one concept, "the document the wizard renders and applies" -
// split across four files only to stay under the removed 150-line cap.

import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'

export const SETUP_RENDERER_CAPABILITIES = [
  'fields',
  'recommendations',
  'plan',
  'plan-sections',
  'descriptions',
  'locales',
  'progress',
  'revisions',
] as const

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

type ValidationContext = {
  addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void
}

export function validateSetupDocument(document: SetupDocument, context: ValidationContext) {
  validateEnglishText(document, context)
  validatePlanSections(document, context)
  validateCapabilities(document, context)
}

function validatePlanSections(document: SetupDocument, context: ValidationContext) {
  const fieldIds = new Set(document.fields.map(({ id }) => id))
  const referenced = new Set<string>()
  for (const [planIndex, item] of document.plan.entries()) {
    for (const [fieldIndex, fieldId] of item.fieldIds.entries()) {
      if (!fieldIds.has(fieldId)) {
        context.addIssue({
          code: 'custom',
          message: `Setup section ${item.id} names unknown field ${fieldId}.`,
          path: ['plan', planIndex, 'fieldIds', fieldIndex],
        })
      }
      if (referenced.has(fieldId)) {
        context.addIssue({
          code: 'custom',
          message: `Setup field ${fieldId} belongs to more than one section.`,
          path: ['plan', planIndex, 'fieldIds', fieldIndex],
        })
      }
      referenced.add(fieldId)
    }
  }
  if (!document.requiredCapabilities.includes('plan-sections')) return
  for (const fieldId of fieldIds) {
    if (!referenced.has(fieldId)) {
      context.addIssue({
        code: 'custom',
        message: `Setup field ${fieldId} does not belong to a section.`,
        path: ['fields'],
      })
    }
  }
}

function validateEnglishText(document: SetupDocument, context: ValidationContext) {
  const english = document.locales.en
  if (!english) {
    context.addIssue({
      code: 'custom',
      message: 'Setup document must provide an English locale.',
      path: ['locales'],
    })
    return
  }
  const fieldIds = new Set<string>()
  for (const [index, field] of document.fields.entries()) {
    const text = english.fields[field.id]
    if (!text) missingEnglish(context, { kind: 'field', id: field.id })
    if (fieldIds.has(field.id)) {
      context.addIssue({
        code: 'custom',
        message: 'Field IDs must be unique.',
        path: ['fields', index, 'id'],
      })
    }
    fieldIds.add(field.id)
    if (field.type === 'choice' && text) validateChoiceText(field, text, context)
  }
  for (const item of document.plan) {
    if (!english.plan[item.id]) missingEnglish(context, { kind: 'plan item', id: item.id })
  }
}

function validateChoiceText(
  field: Extract<SetupDocument['fields'][number], { type: 'choice' }>,
  text: SetupDocument['locales'][string]['fields'][string],
  context: ValidationContext,
) {
  for (const choice of field.choices) {
    if (!text.choices[choice.value]) {
      missingEnglish(context, { kind: 'choice', id: choice.value, fieldId: field.id })
    }
  }
}

function missingEnglish(
  context: ValidationContext,
  missing: { kind: 'field' | 'plan item' | 'choice'; id: string; fieldId?: string },
) {
  const path = missing.fieldId
    ? ['locales', 'en', 'fields', missing.fieldId, 'choices', missing.id]
    : ['locales', 'en', missing.kind === 'field' ? 'fields' : 'plan', missing.id]
  context.addIssue({
    code: 'custom',
    message: `English locale is missing ${missing.kind} ${missing.id}.`,
    path,
  })
}

function validateCapabilities(document: SetupDocument, context: ValidationContext) {
  const known = new Set(SETUP_RENDERER_CAPABILITIES)
  const unknown = document.requiredCapabilities.find(
    (capability) => !known.has(capability as never),
  )
  if (!unknown) return
  context.addIssue({
    code: 'custom',
    message: `Setup document requires an app update for ${unknown}.`,
    path: ['requiredCapabilities'],
  })
}

export function setupLocale(document: SetupDocument, language: string) {
  const locale = document.locales[language] ?? document.locales.en
  if (!locale) throw new Error('Setup document must provide an English locale.')
  return locale
}

export function setupFieldText(document: SetupDocument, language: string, id: string) {
  const locale = setupLocale(document, language)
  const text = locale.fields[id] ?? document.locales.en?.fields[id]
  if (!text) throw new Error(`Setup document is missing field text for ${id}.`)
  return text
}

export function setupPlanText(document: SetupDocument, language: string, id: string) {
  const locale = setupLocale(document, language)
  const text = locale.plan[id] ?? document.locales.en?.plan[id]
  if (!text) throw new Error(`Setup document is missing plan text for ${id}.`)
  return text
}

export function setupChoiceText(
  document: SetupDocument,
  language: string,
  choice: { fieldId: string; value: string },
) {
  const locale = setupLocale(document, language)
  const text =
    locale.fields[choice.fieldId]?.choices[choice.value] ??
    document.locales.en?.fields[choice.fieldId]?.choices[choice.value]
  if (!text) {
    throw new Error(`Setup document is missing choice text for ${choice.fieldId}.${choice.value}.`)
  }
  return text
}

export type SetupAnswers = Readonly<Record<string, string | boolean>>

export function setupAnswers(document: SetupDocument, source: string): SetupAnswers {
  const configuration = parsedConfiguration(source) ?? document.configuration
  return Object.fromEntries(
    document.fields.flatMap((field) => {
      const configured = configurationValue(configuration, field.configurationPath)
      if (validAnswer(field, configured)) {
        return [[field.id, configured]]
      }
      const fallback = field.recommendation ?? field.value
      return fallback === undefined ? [] : [[field.id, fallback]]
    }),
  )
}

function validAnswer(
  field: SetupDocument['fields'][number],
  value: unknown,
): value is string | boolean {
  switch (field.type) {
    case 'text':
      return typeof value === 'string'
    case 'choice':
      return typeof value === 'string' && field.choices.some((choice) => choice.value === value)
    case 'boolean':
      return typeof value === 'boolean'
  }
}

export function setupConfiguration(
  document: SetupDocument,
  answers: SetupAnswers,
  source = '',
): string {
  const configuration = JSON.parse(
    JSON.stringify(parsedConfiguration(source) ?? document.configuration),
  ) as Record<string, unknown>
  for (const field of document.fields) {
    const answer = answers[field.id] ?? field.recommendation ?? field.value
    if (answer !== undefined) setConfigurationValue(configuration, field.configurationPath, answer)
  }
  return `${JSON.stringify(configuration, null, 2)}\n`
}

function setConfigurationValue(
  configuration: Record<string, unknown>,
  path: readonly string[],
  value: string | boolean,
) {
  let parent = configuration
  for (const segment of path.slice(0, -1)) {
    const child = parent[segment]
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      parent = child as Record<string, unknown>
    } else {
      const next: Record<string, unknown> = {}
      parent[segment] = next
      parent = next
    }
  }
  const key = path.at(-1)
  if (key !== undefined) parent[key] = value
}

function parsedConfiguration(source: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(source)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function configurationValue(configuration: Record<string, unknown>, path: readonly string[]) {
  let value: unknown = configuration
  for (const segment of path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}
