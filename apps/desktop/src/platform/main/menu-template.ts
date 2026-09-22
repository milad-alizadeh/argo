import { platformText } from '@/platform/main/i18n'
import { type MenuEntry, REGISTER_PROJECT_COMMAND, shortcut } from '@/platform/contract/commands'

export function menuTemplate(): MenuEntry[] {
  const open = shortcut(REGISTER_PROJECT_COMMAND)
  return [
    { role: 'appMenu' },
    {
      label: platformText('menu.file'),
      submenu: [
        { label: platformText(open.labelKey), accelerator: open.chord, command: open.command },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
}
