// Both ways a command reaches the cockpit: the application menu, and the window-scoped chords the
// menu cannot carry. Both read src/shortcuts.ts, so no chord is written twice (#1786).
import { useEffect, useRef } from 'react'
import { matchesChord, SHORTCUTS } from '../../shortcuts'

export function useCommands(run: (command: string) => void): void {
  const latest = useRef(run)
  useEffect(() => {
    latest.current = run
  })

  useEffect(() => window.argo.onCommand((command) => latest.current(command)), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const pressed = {
        key: event.key,
        meta: event.metaKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
      }
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
