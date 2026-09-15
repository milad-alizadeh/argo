import { useCallback, useState } from 'react'
import type { TurnMarkerEntry, TurnMarkerStage } from '../feed/turn-marker-state'

export type TurnMarkerEntries = Map<string, TurnMarkerEntry>

// Pure transitions over the entries map, directly testable without mounting the hook.
export function beginEntry(
  entries: TurnMarkerEntries,
  key: string,
  entry: { stage: TurnMarkerStage; since: string | null; prompt: string; startedAt: number },
): TurnMarkerEntries {
  return new Map(entries).set(key, entry)
}

// A new Session's Turn began under its draft key; the reply names the real Session id it now
// lives under, before the screen navigates there.
export function rekeyEntry(
  entries: TurnMarkerEntries,
  from: string,
  to: string,
): TurnMarkerEntries {
  const entry = entries.get(from)
  if (entry === undefined) return entries
  const next = new Map(entries)
  next.delete(from)
  next.set(to, entry)
  return next
}

export function clearEntry(entries: TurnMarkerEntries, key: string): TurnMarkerEntries {
  if (!entries.has(key)) return entries
  const next = new Map(entries)
  next.delete(key)
  return next
}

// The Turn Marker's entries, one per Session (or per not-yet-real draft composer) with a Turn in
// flight: local, client-owned state (#2099), so the optimistic prompt row and the Marker itself
// never have to guess whether the CLI has "really" received a Turn before showing it.
export function useTurnMarker() {
  const [entries, setEntries] = useState<TurnMarkerEntries>(() => new Map())

  const begin = useCallback(
    (key: string, entry: { stage: TurnMarkerStage; since: string | null; prompt: string }) => {
      setEntries((current) => beginEntry(current, key, { ...entry, startedAt: Date.now() }))
    },
    [],
  )
  const rekey = useCallback((from: string, to: string) => {
    setEntries((current) => rekeyEntry(current, from, to))
  }, [])
  const clear = useCallback((key: string) => {
    setEntries((current) => clearEntry(current, key))
  }, [])

  return { begin, clear, entries, rekey }
}

export type TurnMarkerApi = ReturnType<typeof useTurnMarker>
