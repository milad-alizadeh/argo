import type { TurnMarkerEntry } from '../feed/turn-marker-state'
import { useComposerStore } from '../state/use-composer-store'

export type TurnMarkerEntries = Map<string, TurnMarkerEntry>

// Pure transitions over the entries map, directly testable without mounting the hook.
export function beginEntry(
  entries: TurnMarkerEntries,
  key: string,
  entry: TurnMarkerEntry,
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
  const markers = useComposerStore(({ markers }) => markers)
  const beginMarker = useComposerStore(({ beginMarker }) => beginMarker)
  const clearMarker = useComposerStore(({ clearMarker }) => clearMarker)
  const rekey = useComposerStore(({ rekey }) => rekey)
  return {
    begin: (key: string, entry: Omit<TurnMarkerEntry, 'startedAt'>) =>
      beginMarker(key, { ...entry, startedAt: Date.now() }),
    clear: clearMarker,
    entries: new Map(Object.entries(markers)),
    rekey,
  }
}

export type TurnMarkerApi = ReturnType<typeof useTurnMarker>
