import { useEffect } from 'react'
import { type ShellCommand, shellCommand } from '@/shell/components'

// Binds the canonical keymap to the window once. The keymap is the power spine over a floor of
// visible affordances, never instead of it — every command reachable here is also clickable
// somewhere in the chrome.

export function useShellKeymap(onCommand: (command: ShellCommand) => void): void {
  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      const command = shellCommand(event)
      if (command === null) return
      // Escape belongs to whatever is layered on top first: Radix portals its open menus into
      // a popper wrapper, and closing one must not also clear the session selection behind it.
      if (command.kind === 'dismiss') {
        if (document.querySelector('[data-radix-popper-content-wrapper]')) return
        onCommand(command)
        return
      }
      event.preventDefault()
      onCommand(command)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onCommand])
}
