import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

// Electron can expose distinct JavaScript wrappers for the same WebFrameMain. The WebContents id
// is stable across those wrappers; the frame URL then keeps a navigated data: document out.
export function isTrustedRendererFrame(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  rendererURL: string,
): boolean {
  return event.sender.id === window.webContents.id && event.senderFrame?.url === rendererURL
}
