import type { SetupDocument } from './setup-document'

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
