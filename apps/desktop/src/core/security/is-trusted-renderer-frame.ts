import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

// The renderer routes itself with `location.hash`, so the frame's URL carries a fragment the
// window was never opened with. The fragment is not part of the document's identity, and a
// comparison that keeps it denies every call made after the first navigation.
function withoutFragment(url: string): string {
  const fragment = url.indexOf('#')
  return fragment === -1 ? url : url.slice(0, fragment)
}

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
  if (rendererURL.startsWith('file:')) return frameURL.startsWith('file:')
  return withoutFragment(frameURL) === withoutFragment(rendererURL)
}
