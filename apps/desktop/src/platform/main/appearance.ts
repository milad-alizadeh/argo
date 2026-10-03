import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_READ_CHANNEL,
  APPEARANCE_READY_CHANNEL,
  APPEARANCE_SET_CHANNEL,
  appearanceReadyRevisionSchema,
} from '@/platform/contract/appearance'
import nativeThemeBackgrounds from '@/platform/contract/native-theme-backgrounds.json'
import { isTrustedRendererFrame } from './security/is-trusted-renderer-frame'
import { createThemeCoordinator, type ThemeCoordinator } from './theme-coordinator'

let coordinator: ThemeCoordinator
let rejectedReadyCount = 0
const windows = new Map<
  BrowserWindow,
  { rendererURL: string; show: boolean; acknowledgedRevision?: number; focus: boolean }
>()

export function appearanceBackground(state = coordinator.read()) {
  return nativeThemeBackgrounds[state.theme][state.dark ? 'dark' : 'light']
}

export async function initializeAppearance(userData: string): Promise<void> {
  coordinator = await createThemeCoordinator(userData, nativeTheme)
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    for (const [window, registration] of windows) {
      if (isTrustedRendererFrame(event, window, registration.rendererURL)) return window
    }
    const sender = BrowserWindow.fromWebContents(event.sender)
    if (sender) {
      for (const registration of windows.values()) {
        if (isTrustedRendererFrame(event, sender, registration.rendererURL)) {
          attachAppearanceWatch(sender, registration.rendererURL, false)
          return sender
        }
      }
    }
    throw new Error('Appearance request came from an untrusted renderer.')
  }
  ipcMain.handle(APPEARANCE_READ_CHANNEL, (event) => {
    trusted(event)
    return coordinator.read()
  })
  ipcMain.handle(APPEARANCE_SET_CHANNEL, (event, value: unknown) => {
    trusted(event)
    return coordinator.mutate(value)
  })
  ipcMain.handle(APPEARANCE_READY_CHANNEL, (event, revision: unknown) => {
    const window = trusted(event)
    const parsed = appearanceReadyRevisionSchema.safeParse(revision)
    if (!parsed.success) {
      rejectedReadyCount += 1
      console.error(`Rejected appearance ready revision #${rejectedReadyCount}:`, parsed.error)
      throw new Error('Appearance ready revision is invalid.')
    }
    const state = coordinator.read()
    const registration = windows.get(window)
    if (!registration || parsed.data !== state.revision) return { ready: false, state }
    registration.acknowledgedRevision = parsed.data
    fulfillAppearanceWindowRequest(window)
    return { ready: true, state }
  })
}

export function focusAppearanceWindow(window: BrowserWindow): void {
  const registration = windows.get(window)
  if (!registration) return
  registration.focus = true
  fulfillAppearanceWindowRequest(window)
}

function fulfillAppearanceWindowRequest(window: BrowserWindow): void {
  const registration = windows.get(window)
  if (!registration || registration.acknowledgedRevision !== coordinator.read().revision) return
  if (registration.focus && window.isMinimized()) window.restore()
  if (registration.show || registration.focus) window.show()
  if (registration.focus) window.focus()
  registration.show = false
  registration.focus = false
}

export function attachAppearanceWatch(
  window: BrowserWindow,
  rendererURL: string,
  show: boolean,
): void {
  windows.set(window, { rendererURL, show, focus: false })
  window.setBackgroundColor(appearanceBackground())
  const unsubscribe = coordinator.subscribe((state) => {
    if (window.isDestroyed()) return
    window.setBackgroundColor(appearanceBackground(state))
    window.webContents.send(APPEARANCE_CHANGED_CHANNEL, state)
  })
  window.once('closed', () => {
    unsubscribe()
    windows.delete(window)
  })
}
