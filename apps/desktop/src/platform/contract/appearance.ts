// The appearance contract, shared by the bundled main process and renderer. System, Light and
// Dark, with System the default and System following the operating system (#1820).
import { z } from 'zod'

export const APPEARANCE_CHANGED_CHANNEL = 'argo:appearance:changed'

export const APPEARANCES = ['system', 'light', 'dark'] as const
export const appearanceSchema = z.enum(APPEARANCES)
export type Appearance = z.infer<typeof appearanceSchema>

// The stored file. Another portable client may hold fields this build does not own, and a write
// must not delete them (docs/portable-integration-contracts.md).
export const appearanceDocumentSchema = z.object({ appearance: appearanceSchema }).passthrough()

// `dark` is the resolved answer: what the window actually draws once System has asked the
// operating system. The renderer needs both, because the control shows the choice and the page
// shows the resolution. This is also the push channel's shape, which carries no request id.
export const appearanceStateSchema = z.strictObject({
  appearance: appearanceSchema,
  dark: z.boolean(),
})
export type AppearanceState = z.infer<typeof appearanceStateSchema>

export const DEFAULT_APPEARANCE: Appearance = 'system'

// The one place a design token is restated outside CSS. A `BrowserWindow` paints its ground before
// the renderer exists and cannot read a stylesheet, so these mirror `--background` in
// `src/platform/renderer/styles/globals.css`: `oklch(1 0 0)` light,
// `oklch(0.145 0 0)` dark. Change one and
// change the other, or the window flashes the wrong ground on every launch.
export const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#0a0a0a' } as const

export function windowBackground(dark: boolean): string {
  return dark ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light
}

export function isAppearance(value: unknown): value is Appearance {
  return appearanceSchema.safeParse(value).success
}

export function isAppearanceState(value: unknown): value is AppearanceState {
  return appearanceStateSchema.safeParse(value).success
}
