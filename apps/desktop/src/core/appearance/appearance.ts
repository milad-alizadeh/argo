// The appearance contract, shared by the bundled main process and renderer. System, Light and
// Dark, with System the default and System following the operating system (#1820).
export const APPEARANCE_CHANNEL = 'argo:appearance'
export const APPEARANCE_CHANGED_CHANNEL = 'argo:appearance:changed'

export const APPEARANCES = ['system', 'light', 'dark'] as const
export const appearanceSchema = z.enum(APPEARANCES)
export type Appearance = z.infer<typeof appearanceSchema>

// `dark` is the resolved answer: what the window actually draws once System has asked the
// operating system. The renderer needs both, because the control shows the choice and the page
// shows the resolution.
export const appearanceStateSchema = z.strictObject({
  appearance: appearanceSchema,
  dark: z.boolean(),
})
export type AppearanceState = z.infer<typeof appearanceStateSchema>

export const DEFAULT_APPEARANCE: Appearance = 'system'

// The one place a design token is restated outside CSS. A `BrowserWindow` paints its ground before
// the renderer exists and cannot read a stylesheet, so these mirror `--background` in
// `src/renderer/styles/globals.css`: `oklch(1 0 0)` light, `oklch(0.145 0 0)` dark. Change one and
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

export type AppearanceClient = {
  getAppearance(): Promise<AppearanceState>
  setAppearance(appearance: Appearance): Promise<AppearanceState>
  onAppearanceChanged(listener: (state: AppearanceState) => void): () => void
}

// A window that cannot read its own appearance still has to draw. Dark is the fallback because it
// is what an unresolved System draws on the reference machine, so a failed read never flashes a
// light window over a dark desktop.
const FALLBACK: AppearanceState = { appearance: DEFAULT_APPEARANCE, dark: true }

export function createAppearanceClient(
  invoke: (appearance: Appearance | null) => Promise<unknown>,
  subscribe: (listener: (state: unknown) => void) => () => void,
): AppearanceClient {
  async function ask(appearance: Appearance | null): Promise<AppearanceState> {
    try {
      const state = await invoke(appearance)
      return isAppearanceState(state) ? state : FALLBACK
    } catch {
      return FALLBACK
    }
  }
  return {
    getAppearance: () => ask(null),
    setAppearance: (appearance) => ask(isAppearance(appearance) ? appearance : null),
    // The disposer is what keeps a remounted component from leaving a listener behind: React runs a
    // mount effect twice in development, and a subscription with no undo is then permanent.
    onAppearanceChanged(listener) {
      return subscribe((state) => {
        if (isAppearanceState(state)) listener(state)
      })
    },
  }
}

import { z } from 'zod'
