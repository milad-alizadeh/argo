// Both ways a command reaches the cockpit: the application menu, and the window-scoped chords the
// menu cannot carry. Both read src/shortcuts.ts, so no chord is written twice (#1786).
import { useEffect, useRef } from 'react'
import { matchesChord, pressedKeys, SHORTCUTS } from '@/core/commands/shortcuts'

export function useCommands(run: (command: string) => void): void {
  const latest = useRef(run)
  useEffect(() => {
    latest.current = run
  })

  useEffect(() => window.argo.onCommand((command) => latest.current(command)), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const pressed = pressedKeys(event)
      const hit = SHORTCUTS.find(
        (entry) => entry.scope === 'window' && matchesChord(entry.chord, pressed),
      )
      if (!hit) return
      event.preventDefault()
      latest.current(hit.command)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
