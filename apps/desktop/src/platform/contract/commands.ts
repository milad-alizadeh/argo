// One shortcut table for the whole app (#1786). Every chord is an entry here and every entry says
// where it fires, because a chord written in the menu and again on an element drifts silently.
// `commands.test.ts` proves the table holds no chord twice and that the built menu takes every
// accelerator from it.
import type { ShortcutLabelKey } from '@/platform/contract/i18n'

// The working surfaces of the cockpit, in sidebar order. The Project is not one of them: it is the
// window's subject, and the surfaces are what a reader does inside it.
export const DESTINATIONS = ['Sessions', 'Tickets', 'Atlas'] as const
export type Destination = (typeof DESTINATIONS)[number]

export const DESTINATION_PATHS: Record<Destination, string> = {
  Sessions: '/sessions',
  Tickets: '/tickets',
  Atlas: '/atlas',
}

export const REGISTER_PROJECT_COMMAND = 'project.register'
// Moving focus down the Session list. These are chords on one element rather than on the window: they
// fire only while a row holds focus, so a reader typing anywhere else keeps their arrow keys.
export const SESSION_LIST_MOVES = {
  next: 'sessionList.next',
  previous: 'sessionList.previous',
  first: 'sessionList.first',
  last: 'sessionList.last',
} as const

// Fires only while the composer holds focus, so Enter elsewhere is untouched (#2103).
export const SEND_MESSAGE_COMMAND = 'composer.send'

// The channel a menu item's command travels on, declared here with the table it comes from.
export const COMMAND_CHANNEL = 'argo:command'

export type ShortcutScope = 'menu' | 'window' | 'element'
// `labelKey` names the word in the `platform` catalog rather than holding it, so the menu the main
// process builds and the shortcut list the renderer draws say the same thing (#2130).
export type Shortcut = {
  command: string
  labelKey: ShortcutLabelKey
  chord: string
  scope: ShortcutScope
}

export const navigateCommand = (destination: Destination): string =>
  `navigate.${destination.toLowerCase()}`

const DESTINATION_LABEL_KEYS: Record<Destination, ShortcutLabelKey> = {
  Sessions: 'shortcut.navigate.sessions',
  Tickets: 'shortcut.navigate.tickets',
  Atlas: 'shortcut.navigate.atlas',
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    command: REGISTER_PROJECT_COMMAND,
    labelKey: 'shortcut.project.register',
    chord: 'CmdOrCtrl+O',
    scope: 'menu',
  },
  ...DESTINATIONS.map((destination, index) => ({
    command: navigateCommand(destination),
    labelKey: DESTINATION_LABEL_KEYS[destination],
    chord: `CmdOrCtrl+${index + 1}`,
    scope: 'window' as const,
  })),
  {
    command: SESSION_LIST_MOVES.next,
    labelKey: 'shortcut.sessionList.next',
    chord: 'ArrowDown',
    scope: 'element',
  },
  {
    command: SESSION_LIST_MOVES.previous,
    labelKey: 'shortcut.sessionList.previous',
    chord: 'ArrowUp',
    scope: 'element',
  },
  {
    command: SESSION_LIST_MOVES.first,
    labelKey: 'shortcut.sessionList.first',
    chord: 'Home',
    scope: 'element',
  },
  {
    command: SESSION_LIST_MOVES.last,
    labelKey: 'shortcut.sessionList.last',
    chord: 'End',
    scope: 'element',
  },
  {
    command: SEND_MESSAGE_COMMAND,
    labelKey: 'shortcut.composer.send',
    chord: 'Enter',
    scope: 'element',
  },
]

// The template is plain data so that the table's rule can be proved without Electron.
// `platform/main/menu.ts` turns it into a real `Menu`.
export type MenuEntry = {
  label?: string
  role?: string
  accelerator?: string
  command?: string
  submenu?: MenuEntry[]
}

export const shortcut = (command: string): Shortcut => {
  const found = SHORTCUTS.find((entry) => entry.command === command)
  if (!found) throw new Error(`No shortcut is declared for ${command}`)
  return found
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

export function pressedKeys(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}): PressedKeys {
  return {
    key: event.key,
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  }
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

export function matchesShortcut(command: string, pressed: PressedKeys): boolean {
  const shortcut = SHORTCUTS.find((entry) => entry.command === command)
  return shortcut !== undefined && matchesChord(shortcut.chord, pressed)
}
