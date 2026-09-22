import type { StoreApi } from 'zustand'
import { updateComposerEntries } from './composer-entry-records'
import { rekeyComposerRecords } from './rekey-composer-records'
import type { ComposerState, PendingTurn } from './use-composer-store'

type ComposerSet = StoreApi<ComposerState>['setState']

export function turnActions(set: ComposerSet) {
  return {
    chooseSetup: (composerKey: string, setup: ComposerState['setup'][string]) =>
      set(({ setup: choices }) => ({ setup: { ...choices, [composerKey]: setup } })),
    addPendingTurn: (composerKey: string, turn: PendingTurn) =>
      set(({ pendingTurns }) => ({
        pendingTurns: {
          ...pendingTurns,
          [composerKey]: [...(pendingTurns[composerKey] ?? []), turn],
        },
      })),
    removePendingTurn: (composerKey: string, id: string) =>
      set(({ pendingTurns }) => ({
        pendingTurns: updateComposerEntries(pendingTurns, composerKey, (turns) =>
          turns.filter((turn) => turn.id !== id),
        ),
      })),
    reorderPendingTurn: (composerKey: string, sourceId: string, targetId: string) =>
      set(({ pendingTurns }) => {
        const turns = pendingTurns[composerKey] ?? []
        const sourceIndex = turns.findIndex(({ id }) => id === sourceId)
        const targetIndex = turns.findIndex(({ id }) => id === targetId)
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
          return { pendingTurns }
        const next = [...turns]
        const [source] = next.splice(sourceIndex, 1)
        if (source === undefined) return { pendingTurns }
        next.splice(targetIndex, 0, source)
        return { pendingTurns: { ...pendingTurns, [composerKey]: next } }
      }),
    beginMarker: (composerKey: string, marker: ComposerState['markers'][string]) =>
      set(({ markers }) => ({ markers: { ...markers, [composerKey]: marker } })),
    clearMarker: (composerKey: string) =>
      set(({ markers }) => {
        if (markers[composerKey] === undefined) return { markers }
        const { [composerKey]: _cleared, ...remaining } = markers
        return { markers: remaining }
      }),
    rekey: (from: string, to: string) => set((state) => rekeyComposerRecords(state, from, to)),
  }
}
