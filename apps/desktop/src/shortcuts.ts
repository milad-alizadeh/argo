// One shortcut table for the whole app (#1786). Every chord is an entry here and every entry says
// where it fires, because a chord written in the menu and again on an element drifts silently.
// `shortcuts.test.mjs` proves the table holds no chord twice and that the built menu takes every
// accelerator from it.

// The working surfaces of the cockpit, in sidebar order. Code is a placeholder in this slice and
// stays in the table, because a destination that is not reachable is a destination nobody notices
// is missing.
export const DESTINATIONS = ['Projects', 'Sessions', 'Tickets', 'Atlas', 'Code'] as const
export type Destination = (typeof DESTINATIONS)[number]

export const REGISTER_PROJECT_COMMAND = 'project.register'

// The channel a menu item's command travels on, declared here with the table it comes from.
export const COMMAND_CHANNEL = 'argo:command'

export type ShortcutScope = 'menu' | 'window' | 'element'
export type Shortcut = { command: string; label: string; chord: string; scope: ShortcutScope }

export const navigateCommand = (destination: Destination): string =>
  `navigate.${destination.toLowerCase()}`

export const SHORTCUTS: readonly Shortcut[] = [
  {
    command: REGISTER_PROJECT_COMMAND,
    label: 'Open Project…',
    chord: 'CmdOrCtrl+O',
    scope: 'menu',
  },
  ...DESTINATIONS.map((destination, index) => ({
    command: navigateCommand(destination),
    label: destination,
    chord: `CmdOrCtrl+${index + 1}`,
    scope: 'window' as const,
  })),
]

// The template is plain data so that the table's rule can be proved without Electron. `src/menu.ts`
// turns it into a real `Menu`.
export type MenuEntry = {
  label?: string
  role?: string
  accelerator?: string
  command?: string
  submenu?: MenuEntry[]
}

const shortcut = (command: string): Shortcut => {
  const found = SHORTCUTS.find((entry) => entry.command === command)
  if (!found) throw new Error(`No shortcut is declared for ${command}`)
  return found
}

export function menuTemplate(): MenuEntry[] {
  const open = shortcut(REGISTER_PROJECT_COMMAND)
  return [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [{ label: open.label, accelerator: open.chord, command: open.command }],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
}

export function menuAccelerators(entries: MenuEntry[]): string[] {
  return entries.flatMap((entry) => [
    ...(entry.accelerator ? [entry.accelerator] : []),
    ...menuAccelerators(entry.submenu ?? []),
  ])
}

// A chord as the renderer sees one. The main process never needs this: Electron parses its own
// accelerators, and a window-scoped chord reaches no menu item to parse it.
export type PressedKeys = {
  key: string
  meta: boolean
  ctrl: boolean
  shift: boolean
  alt: boolean
}

// The modifier has to be absent as exactly as it has to be present, so `CmdOrCtrl+1` refuses
// `Shift+Cmd+1` rather than swallowing it.
export function matchesChord(chord: string, pressed: PressedKeys): boolean {
  const parts = chord.split('+')
  const key = parts.at(-1) ?? ''
  const modifiers = parts.slice(0, -1)
  return (
    pressed.key.toLowerCase() === key.toLowerCase() &&
    modifiers.includes('CmdOrCtrl') === (pressed.meta || pressed.ctrl) &&
    modifiers.includes('Shift') === pressed.shift &&
    modifiers.includes('Alt') === pressed.alt
  )
}
