import { z } from 'zod'
import { type Harness, harnessSchema } from './harness'

const readingSchema = z.strictObject({
  exact: z.array(z.string()),
  prefixes: z.array(z.string()),
})
const modelChoiceSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().optional(),
  efforts: z.array(z.string()),
  defaultEffort: z.string().min(1),
  supportedModes: z.array(z.string().min(1)).optional(),
  readings: readingSchema,
})
const catalogModeSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
  detail: z.string(),
  icon: z.enum([
    'mode-auto',
    'mode-manual',
    'mode-accept-edits',
    'mode-plan',
    'mode-dont-ask',
    'mode-bypass-permissions',
    'mode-approve-safely',
  ]),
  readings: readingSchema,
})
const setupChoiceSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
  readings: readingSchema,
})
const availableHarnessSchema = z.strictObject({
  harness: harnessSchema,
  availability: z.literal('available'),
  agent: z.string().min(1),
  label: z.string().min(1),
  defaultModelId: z.string().min(1),
  modes: z.array(catalogModeSchema),
  models: z.array(modelChoiceSchema),
  efforts: z.array(setupChoiceSchema),
  opening: z.strictObject({
    model: z.string(),
    effort: z.string(),
    mode: z.string(),
  }),
})
const unavailableHarnessSchema = z.strictObject({
  harness: harnessSchema,
  availability: z.literal('unavailable'),
  reason: z.enum(['not-installed', 'not-signed-in', 'invalid-response', 'unavailable']),
  detail: z.string().optional(),
})
// Reader text: the step that installs a missing Harness, carried only by not-installed.
const notInstalledHarnessSchema = unavailableHarnessSchema.extend({
  reason: z.literal('not-installed'),
  installStep: z.string().min(1),
})
export const harnessInfoSchema = z.union([
  availableHarnessSchema,
  notInstalledHarnessSchema,
  unavailableHarnessSchema,
])
export const harnessCatalogSchema = z
  .strictObject({
    harnesses: z.array(harnessInfoSchema),
  })
  .refine(
    ({ harnesses }) =>
      harnesses.length === harnessSchema.options.length &&
      harnessSchema.options.every((harness, index) => harnesses[index]?.harness === harness),
    'The catalog lists each Harness once, in registry order.',
  )
export const catalogReadResultSchema = z.strictObject({
  info: harnessInfoSchema,
  failure: z.string().nullable(),
})
export type HarnessInfo = z.infer<typeof harnessInfoSchema>
export type HarnessCatalog = z.infer<typeof harnessCatalogSchema>
export type CatalogReading = z.infer<typeof readingSchema>
export type CatalogReadResult = z.infer<typeof catalogReadResultSchema>
export type AvailableHarness = Extract<
  HarnessInfo,
  {
    availability: 'available'
  }
>

export function unavailable(harness: Harness): HarnessInfo {
  return {
    harness,
    availability: 'unavailable',
    reason: 'unavailable',
  }
}

export function notInstalled(harness: Harness, installStep: string): HarnessInfo {
  return { harness, availability: 'unavailable', reason: 'not-installed', installStep }
}

export function invalidCatalogResponse(harness: Harness, error: z.ZodError): HarnessInfo {
  return {
    harness,
    availability: 'unavailable',
    reason: 'invalid-response',
    detail: error.message,
  }
}

export function unavailableCatalog(): HarnessCatalog {
  return { harnesses: harnessSchema.options.map(unavailable) }
}
