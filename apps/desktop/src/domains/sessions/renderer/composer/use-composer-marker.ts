import { useCallback, useEffect, useRef } from 'react'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import {
  type ComposerIdentity,
  composerIdentityKey,
  findSessionRow,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { useTurnMarker } from '@/domains/sessions/renderer/composer/use-turn-marker'
import {
  optimisticRowFor,
  runningTurnView,
  settledPromptRowFor,
  type TurnMarkerEntry,
  type TurnMarkerRow,
  turnEnded,
  turnMarkerView,
} from '@/domains/sessions/renderer/feed/turn-marker-state'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'

// The Turn Marker's lifecycle (#2099): retire an entry on a successful interrupt or once the
// Session's real record catches up to it, and read the current identity's entry into the two
// facts the Feed renders (the Marker itself, and the optimistic prompt row it stands in for).
export function canRestoreInterruptedMarker(
  entry: TurnMarkerEntry,
  currentEntry: TurnMarkerEntry | undefined,
  row: TurnMarkerRow | null,
) {
  return (
    currentEntry === undefined && row?.status === 'running' && row.turnStartedAt === entry.since
  )
}

export function useComposerMarker(options: {
  marker: ReturnType<typeof useTurnMarker>
  roster: ReturnType<typeof useSessions>['roster']
  identity: ComposerIdentity
  selectedRow: SessionRosterRow | null
  sessionId: string | null
  onInterruptBase: () => Promise<boolean>
}) {
  const { marker, roster, identity, selectedRow, sessionId, onInterruptBase } = options
  const currentRoster = useRef(roster)
  useEffect(() => {
    currentRoster.current = roster
  }, [roster])
  const onInterrupt = useCallback(async () => {
    const entry = sessionId === null ? undefined : marker.entries.get(sessionId)
    if (sessionId !== null) marker.clear(sessionId)
    const interrupted = await onInterruptBase()
    if (
      !interrupted &&
      sessionId !== null &&
      entry !== undefined &&
      canRestoreInterruptedMarker(
        entry,
        useComposerStore.getState().markers[sessionId],
        findSessionRow(currentRoster.current, sessionId),
      )
    )
      marker.begin(sessionId, entry)
    return interrupted
  }, [onInterruptBase, sessionId, marker, marker.entries])
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
