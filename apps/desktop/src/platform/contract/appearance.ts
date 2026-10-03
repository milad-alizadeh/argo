import { z } from 'zod'

export const THEMES = ['default', 'supabase', 'linear', 'amber-minimal'] as const
export const APPEARANCES = ['system', 'light', 'dark'] as const
export const DEFAULT_THEME = 'default'
export const DEFAULT_APPEARANCE = 'system'
const retiredThemes = ['catppuccin', 'ocean-breeze', 'northern-lights'] as const
export const APPEARANCE_READ_CHANNEL = 'argo:appearance:read'
export const APPEARANCE_SET_CHANNEL = 'argo:appearance:set'
export const APPEARANCE_READY_CHANNEL = 'argo:appearance:ready'
export const APPEARANCE_CHANGED_CHANNEL = 'argo:appearance:changed'

const themeSchema = z.enum(THEMES)
export const appearanceSchema = z.enum(APPEARANCES)
export type Appearance = z.infer<typeof appearanceSchema>

export const appearancePreferenceSchema = z.strictObject({
  theme: themeSchema,
  appearance: appearanceSchema,
})
export type AppearancePreference = z.infer<typeof appearancePreferenceSchema>

// Existing portable appearance documents can omit the new theme field.
export const appearanceDocumentSchema = z
  .object({
    theme: z.preprocess(
      (value) => (retiredThemes.some((theme) => theme === value) ? DEFAULT_THEME : value),
      themeSchema.default(DEFAULT_THEME),
    ),
    appearance: appearanceSchema,
  })
  .passthrough()

export const appearanceStateSchema = appearancePreferenceSchema.extend({
  dark: z.boolean(),
  revision: z.number().int().nonnegative(),
})
export type AppearanceState = z.infer<typeof appearanceStateSchema>

export const appearanceReadyRevisionSchema = z.number().int().nonnegative()
export const appearanceReadyResultSchema = z.strictObject({
  ready: z.boolean(),
  state: appearanceStateSchema,
})

export const appearanceMutationSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), state: appearanceStateSchema }),
  z.strictObject({
    ok: z.literal(false),
    reason: z.enum(['invalid', 'storage']),
    state: appearanceStateSchema,
  }),
])
export type AppearanceMutation = z.infer<typeof appearanceMutationSchema>
