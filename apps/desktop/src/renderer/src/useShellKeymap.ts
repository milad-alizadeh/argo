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
      event.preventDefault()
      onCommand(command)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onCommand])
}
