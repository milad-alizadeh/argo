// The main process owns the appearance choice: it holds `nativeTheme.themeSource`, so the native
// window frame follows the page, and it writes the choice to `userData` (apps/desktop/AGENTS.md).
import path from 'node:path'
import { type BrowserWindow, nativeTheme } from 'electron'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'
import { otherFields, readDocument, writeDocument } from '@/platform/main/storage/portable-file'
import {
  APPEARANCE_CHANGED_CHANNEL,
  APPEARANCE_OPERATIONS,
  type Appearance,
  type AppearanceReply,
  type AppearanceState,
  appearanceDocumentSchema,
  appearanceError,
  DEFAULT_APPEARANCE,
  windowBackground,
} from '@/platform/contract/appearance'

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

const OWNED = ['version', 'appearance']

// Read fresh each time rather than cached, so a write keeps whatever another portable client holds
// right up to the moment this one saves.
async function readAppearanceDocument(
  userData: string,
): Promise<{ appearance: Appearance; other: Record<string, unknown> }> {
  const read = await readDocument(settingsPath(userData))
  if (!read.ok) return { appearance: DEFAULT_APPEARANCE, other: {} }
  const parsed = appearanceDocumentSchema.safeParse(read.document)
  const appearance = parsed.success ? parsed.data.appearance : DEFAULT_APPEARANCE
  return { appearance, other: otherFields(read.document, OWNED) }
}

export async function readAppearance(userData: string): Promise<Appearance> {
  return (await readAppearanceDocument(userData)).appearance
}

async function writeAppearance(userData: string, appearance: Appearance): Promise<void> {
  const { other } = await readAppearanceDocument(userData)
  // The window already shows the new appearance. A write that fails costs the next launch its
  // choice and nothing else, so there is no failure to report to the renderer.
  await writeDocument(settingsPath(userData), { ...other, version: 1, appearance })
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
