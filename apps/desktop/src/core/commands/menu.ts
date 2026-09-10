// The application menu. A menu item sends the command to the renderer rather than acting in the
// main process, so the menu and the on-screen control reach the one action through one contract.
import { type BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { COMMAND_CHANNEL, type MenuEntry, menuTemplate } from './shortcuts'

function toMenuItem(entry: MenuEntry, window: BrowserWindow): MenuItemConstructorOptions {
  const { command, submenu, role, ...rest } = entry
  return {
    ...rest,
    ...(role ? { role: role as MenuItemConstructorOptions['role'] } : {}),
    ...(submenu ? { submenu: submenu.map((child) => toMenuItem(child, window)) } : {}),
    ...(command ? { click: () => window.webContents.send(COMMAND_CHANNEL, command) } : {}),
  }
}

export function installMenu(window: BrowserWindow): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(menuTemplate().map((entry) => toMenuItem(entry, window))),
  )
}
