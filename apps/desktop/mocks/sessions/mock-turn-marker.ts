import {
  beginEntry,
  clearEntry,
  rekeyEntry,
  type TurnMarkerApi,
  type TurnMarkerEntries,
} from '../../src/domains/sessions/renderer/composer/use-turn-marker'

export function mockTurnMarker() {
  const marker = {
    entries: new Map() as TurnMarkerEntries,
    begin: (key: string, entry: Parameters<TurnMarkerApi['begin']>[1]) => {
      marker.entries = beginEntry(marker.entries, key, { ...entry, startedAt: 0 })
    },
    rekey: (from: string, to: string) => {
      marker.entries = rekeyEntry(marker.entries, from, to)
    },
    clear: (key: string) => {
      marker.entries = clearEntry(marker.entries, key)
    },
  }
  return marker
}
