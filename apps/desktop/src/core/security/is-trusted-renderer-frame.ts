import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

// Electron can expose distinct JavaScript wrappers for the same WebFrameMain. The WebContents id
// is stable across those wrappers. Packaged file URLs are normalized by Electron, so trust their
// scheme; the navigation guard keeps other local documents out. A dev-server URL stays exact.
export function isTrustedRendererFrame(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererURL: string,
): boolean {
  if (event.sender.id !== window.webContents.id) return false
  const frameURL = event.senderFrame?.url
  if (!frameURL) return false
  return rendererURL.startsWith('file:') ? frameURL.startsWith('file:') : frameURL === rendererURL
}
