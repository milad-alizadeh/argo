import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

// The renderer routes itself with `location.hash`, so the frame's URL carries a fragment the
// window was never opened with. Forge's dev-server URL has no trailing slash and the frame's does,
// so both sides are parsed before they are compared.
function documentURL(url: string): string {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href
}

// Packaged file URLs are normalized by Electron, so trust their scheme; the navigation guard keeps
// other local documents out. A dev-server document must match exactly.
export function isRendererDocument(frameURL: string, rendererURL: string): boolean {
  if (rendererURL.startsWith('file:')) return frameURL.startsWith('file:')
  if (!(URL.canParse(frameURL) && URL.canParse(rendererURL))) return false
  return documentURL(frameURL) === documentURL(rendererURL)
}

// Electron can expose distinct JavaScript wrappers for the same WebFrameMain. The WebContents id
// is stable across those wrappers.
export function isTrustedRendererFrame(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererURL: string,
): boolean {
  if (event.sender.id !== window.webContents.id) return false
  const frameURL = event.senderFrame?.url
  if (!frameURL) return false
  return isRendererDocument(frameURL, rendererURL)
}
