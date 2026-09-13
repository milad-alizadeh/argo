import { type BrowserWindow, shell } from 'electron'
import { isExternalLink } from './urls'

// The window never leaves the renderer. A new-window request for a web or mail link goes to the
// default browser instead, which is how a Feed link opens.
export function attachWindowNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalLink(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
}
