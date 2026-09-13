// The main process owns the appearance choice: it holds `nativeTheme.themeSource`, so the native
// window frame follows the page, and it writes the choice to `userData` (apps/desktop/AGENTS.md).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type BrowserWindow, type IpcMainInvokeEvent, nativeTheme } from 'electron'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_OPERATIONS,
  type Appearance,
  type AppearanceState,
  DEFAULT_APPEARANCE,
  isAppearance,
  windowBackground,
} from './appearance'

const state = (): AppearanceState => ({
  appearance: nativeTheme.themeSource,
  dark: nativeTheme.shouldUseDarkColors,
})

function settingsPath(userData: string): string {
  return path.join(userData, 'portable-v1', 'appearance.json')
}

export async function readAppearance(userData: string): Promise<Appearance> {
  try {
    const stored: unknown = JSON.parse(await readFile(settingsPath(userData), 'utf8'))
    const appearance = (stored as { appearance?: unknown } | null)?.appearance
    return isAppearance(appearance) ? appearance : DEFAULT_APPEARANCE
  } catch {
    return DEFAULT_APPEARANCE
  }
}

async function writeAppearance(userData: string, appearance: Appearance): Promise<void> {
  try {
    await mkdir(path.dirname(settingsPath(userData)), { recursive: true })
    await writeFile(settingsPath(userData), `${JSON.stringify({ version: 1, appearance })}\n`)
  } catch {
    // The window already shows the new appearance. Losing the file costs the next launch its
    // choice and nothing else, so there is no failure to report to the renderer.
  }
}

export function applyStoredAppearance(appearance: Appearance): void {
  nativeTheme.themeSource = appearance
}

export type AppearanceStorage = { userData: string; rendererURL: string }

export function attachAppearanceBridge(window: BrowserWindow, storage: AppearanceStorage): void {
  const { userData, rendererURL } = storage
  const handlers = {
    get: () => state(),
    set: async (event: IpcMainInvokeEvent, request: unknown) => {
      const parsed = APPEARANCE_OPERATIONS.set.request.safeParse(request)
      if (isTrustedRendererFrame(event, window, rendererURL) && parsed.success) {
        nativeTheme.themeSource = parsed.data.appearance
        await writeAppearance(userData, parsed.data.appearance)
      }
      return state()
    },
  } satisfies Record<
    keyof typeof APPEARANCE_OPERATIONS,
    (event: IpcMainInvokeEvent, request: unknown) => Promise<AppearanceState> | AppearanceState
  >
  for (const operation of Object.keys(APPEARANCE_OPERATIONS) as Array<
    keyof typeof APPEARANCE_OPERATIONS
  >) {
    window.webContents.ipc.handle(APPEARANCE_OPERATIONS[operation].channel, handlers[operation])
  }
  // System has to follow the operating system while the window is open, and only the main process
  // is told when that changes.
  const push = () => {
    if (window.isDestroyed()) return
    const current = state()
    window.setBackgroundColor(windowBackground(current.dark))
    window.webContents.send(APPEARANCE_CHANGED_CHANNEL, current)
  }
  nativeTheme.on('updated', push)
  window.on('closed', () => nativeTheme.off('updated', push))
}
