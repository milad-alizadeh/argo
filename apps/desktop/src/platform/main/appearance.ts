// The main process owns the appearance choice: it holds `nativeTheme.themeSource`, so the native
// window frame follows the page, and it writes the choice to `userData`.
import path from 'node:path'
import { type BrowserWindow, nativeTheme } from 'electron'
import {
  APPEARANCE_CHANGED_CHANNEL,
  type Appearance,
  type AppearanceState,
  appearanceDocumentSchema,
  DEFAULT_APPEARANCE,
  windowBackground,
} from '@/platform/contract/appearance'
import { readDocument } from './storage/portable-file'

const state = (): AppearanceState => ({
  appearance: nativeTheme.themeSource,
  dark: nativeTheme.shouldUseDarkColors,
})

function settingsPath(userData: string): string {
  return path.join(userData, 'portable-v1', 'appearance.json')
}

async function readAppearanceDocument(userData: string): Promise<Appearance> {
  const read = await readDocument(settingsPath(userData))
  if (!read.ok) return DEFAULT_APPEARANCE
  const parsed = appearanceDocumentSchema.safeParse(read.document)
  return parsed.success ? parsed.data.appearance : DEFAULT_APPEARANCE
}

export async function readAppearance(userData: string): Promise<Appearance> {
  return readAppearanceDocument(userData)
}

export function applyStoredAppearance(appearance: Appearance): void {
  nativeTheme.themeSource = appearance
}

export function attachAppearanceWatch(window: BrowserWindow): void {
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
