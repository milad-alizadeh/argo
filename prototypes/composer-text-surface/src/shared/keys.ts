// PROTOTYPE. ComposerKeyIntent.swift in the browser's own vocabulary.

export type KeyIntent =
  | 'submit'
  | 'newline'
  | 'walkDown'
  | 'walkUp'
  | 'complete'
  | 'dismiss'
  | 'pass'

/**
 * What a keystroke at the composer means, decided before the surface acts on it.
 *
 * `event.code` and not `event.key`: layout-independent, the browser's answer to the Swift's
 * virtual key codes. A Dvorak layout moves every letter and none of these.
 */
export function intentOf(event: {
  code: string
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
}): KeyIntent {
  const { code, shiftKey, altKey, metaKey, ctrlKey } = event
  const bare = !shiftKey && !altKey && !metaKey && !ctrlKey
  switch (code) {
    case 'Enter':
    case 'NumpadEnter':
      // Command or Control held is somebody reaching for a shortcut, and a Turn sent out from
      // under a missed shortcut is the one outcome here with no undo.
      if (metaKey || ctrlKey) return 'pass'
      return bare ? 'submit' : 'newline'
    case 'ArrowDown':
      return bare ? 'walkDown' : 'pass'
    case 'ArrowUp':
      return bare ? 'walkUp' : 'pass'
    case 'Escape':
      return bare ? 'dismiss' : 'pass'
    case 'Tab':
      return bare ? 'complete' : 'pass'
    default:
      return 'pass'
  }
}
