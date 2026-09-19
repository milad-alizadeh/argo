import { useCallback, useEffect } from 'react'
import type { SessionRosterRow } from '@/domains/sessions/contract/models'
import {
  optimisticRowFor,
  runningTurnView,
  settledPromptRowFor,
  turnEnded,
  turnMarkerView,
} from '@/domains/sessions/renderer/feed/turn-marker-state'
import {
  type ComposerIdentity,
  composerIdentityKey,
  findSessionRow,
} from '@/domains/sessions/renderer/hooks/composer-identity'
import type { useSessions } from '@/domains/sessions/renderer/hooks/use-sessions'
import type { useTurnMarker } from '@/domains/sessions/renderer/hooks/use-turn-marker'

// The Turn Marker's lifecycle (#2099): retire an entry on a successful interrupt or once the
// Session's real record catches up to it, and read the current identity's entry into the two
// facts the Feed renders (the Marker itself, and the optimistic prompt row it stands in for).
export function useComposerMarker(options: {
  marker: ReturnType<typeof useTurnMarker>
  roster: ReturnType<typeof useSessions>['roster']
  identity: ComposerIdentity
  selectedRow: SessionRosterRow | null
  sessionId: string | null
  onInterruptBase: () => Promise<boolean>
}) {
  const { marker, roster, identity, selectedRow, sessionId, onInterruptBase } = options
  const onInterrupt = useCallback(async () => {
    const interrupted = await onInterruptBase()
    if (interrupted && sessionId !== null) marker.clear(sessionId)
    return interrupted
  }, [onInterruptBase, sessionId, marker])
  useEffect(() => {
    for (const [key, entry] of marker.entries) {
      const row = findSessionRow(roster, key)
      if (turnEnded(entry, row)) marker.clear(key)
    }
  }, [roster, marker.entries, marker.clear])
  const markerEntry = marker.entries.get(composerIdentityKey(identity)) ?? null
  return {
    onInterrupt,
    markerView:
      markerEntry === null
        ? runningTurnView(selectedRow)
        : turnMarkerView(markerEntry, selectedRow),
    optimisticRow: markerEntry === null ? null : optimisticRowFor(markerEntry, selectedRow),
    settledPromptRow: markerEntry === null ? null : settledPromptRowFor(markerEntry, selectedRow),
  }
}
