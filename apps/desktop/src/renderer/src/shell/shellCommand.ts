import type { Room } from './shellModel'

// The canonical keymap as ONE table, so the shortcut a room tab advertises and the shortcut
// that fires can never disagree. It reads `metaKey` alone: macOS is the target platform, and
// the chrome the keymap drives (hiddenInset traffic lights, the dock badge) is macOS's too.
//
// The keymap is the power spine, never the floor: every command here is also a visible
// clickable affordance somewhere in the chrome.

/** What a shortcut asks the shell to do. */
export type ShellCommand =
  | { kind: 'room'; room: Room }
  | { kind: 'project'; step: -1 | 1 }
  | { kind: 'palette' }
  | { kind: 'spawn' }
  | { kind: 'dismiss' }

const WITH_META: Record<string, ShellCommand> = {
  '1': { kind: 'room', room: 'sessions' },
  '2': { kind: 'room', room: 'work' },
  '3': { kind: 'room', room: 'code' },
  '[': { kind: 'project', step: -1 },
  ']': { kind: 'project', step: 1 },
  k: { kind: 'palette' },
  n: { kind: 'spawn' },
}

/** The command a keystroke asks for, or null when the shell claims no shortcut for it. */
export function shellCommand(event: { key: string; metaKey: boolean }): ShellCommand | null {
  if (event.key === 'Escape') return { kind: 'dismiss' }
  if (!event.metaKey) return null
  return WITH_META[event.key.toLowerCase()] ?? null
}
