// The main process owns the appearance choice: it holds `nativeTheme.themeSource`, so the native
// window frame follows the page, and it writes the choice to `userData` (apps/desktop/AGENTS.md).
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { type BrowserWindow, nativeTheme } from 'electron'
import { registerDomainHandlers } from '../contract/domain'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_OPERATIONS,
  type Appearance,
  type AppearanceReply,
  type AppearanceState,
  appearanceError,
  DEFAULT_APPEARANCE,
  isAppearance,
  windowBackground,
} from './appearance'

const state = (): AppearanceState => ({
  appearance: nativeTheme.themeSource,
  dark: nativeTheme.shouldUseDarkColors,
})

const reply = (requestId: string): AppearanceReply => ({
  version: 1,
  type: 'appearance.state',
  requestId,
  ...state(),
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
  registerDomainHandlers({
    window,
    rendererURL,
    operations: APPEARANCE_OPERATIONS,
    context: userData,
    handlers: {
      get: (request) => reply(request.requestId),
      set: async (request, data) => {
        nativeTheme.themeSource = request.appearance
        await writeAppearance(data, request.appearance)
        return reply(request.requestId)
      },
    },
    error: appearanceError,
  })
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
