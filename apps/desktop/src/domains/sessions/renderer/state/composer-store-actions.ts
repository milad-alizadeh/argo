import type { StoreApi } from 'zustand'
import { rekeyComposerRecord } from './rekey-composer-record'
import type { ComposerState, PendingTurn } from './use-composer-store'

type ComposerSet = StoreApi<ComposerState>['setState']
function updateEntries<T>(
  entries: Record<string, T[]>,
  composerKey: string,
  update: (current: T[]) => T[],
): Record<string, T[]> {
  const updated = update(entries[composerKey] ?? [])
  if (updated.length === 0) {
    const { [composerKey]: _replaced, ...others } = entries
    return others
  }
  return { ...entries, [composerKey]: updated }
}
function draftActions(set: ComposerSet) {
  return {
    chooseHarness: (harness: ComposerState['harness']) => set({ harness }),
    setDraft: (composerKey: string, text: string) =>
      set(({ drafts }) => {
        const { [composerKey]: _replaced, ...others } = drafts
        return { drafts: text === '' ? others : { ...others, [composerKey]: text } }
      }),
  }
}
function attachmentActions(set: ComposerSet) {
  return {
    addAttachments: (composerKey: string, paths: string[]) =>
      set(({ attachments }) => ({
        attachments: updateEntries(attachments, composerKey, (current) => {
          const known = new Set(current.map((attachment) => attachment.path))
          const reattached = new Set(paths.filter((path) => known.has(path)))
          const added = paths
            .filter((path) => !known.has(path))
            .map((path) => ({ id: crypto.randomUUID(), path, status: 'idle' as const }))
          return [
            ...current.map((attachment) =>
              reattached.has(attachment.path)
                ? { ...attachment, status: 'idle' as const }
                : attachment,
            ),
            ...added,
          ]
        }),
      })),
    removeAttachment: (composerKey: string, id: string) =>
      set(({ attachments }) => ({
        attachments: updateEntries(attachments, composerKey, (current) =>
          current.filter((item) => item.id !== id),
        ),
      })),
    markAttachmentsError: (composerKey: string, ids: string[]) =>
      set(({ attachments }) => ({
        attachments: updateEntries(attachments, composerKey, (current) =>
          current.map((attachment) =>
            ids.includes(attachment.id) ? { ...attachment, status: 'error' } : attachment,
          ),
        ),
      })),
    removeAttachments: (composerKey: string, ids: string[]) =>
      set(({ attachments }) => ({
        attachments: updateEntries(attachments, composerKey, (current) =>
          current.filter((attachment) => !ids.includes(attachment.id)),
        ),
      })),
  }
}
function ticketActions(set: ComposerSet) {
  return {
    addTicket: (
      composerKey: string,
      ticket: Omit<ComposerState['tickets'][string][number], 'id'>,
    ) =>
      set(({ tickets }) => {
        const current = tickets[composerKey] ?? []
        if (current.some(({ provider, key }) => provider === ticket.provider && key === ticket.key))
          return { tickets }
        return {
          tickets: {
            ...tickets,
            [composerKey]: [...current, { ...ticket, id: crypto.randomUUID() }],
          },
        }
      }),
    removeTicket: (composerKey: string, id: string) =>
      set(({ tickets }) => ({
        tickets: updateEntries(tickets, composerKey, (current) =>
          current.filter((ticket) => ticket.id !== id),
        ),
      })),
  }
}
function turnActions(set: ComposerSet) {
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
        pendingTurns: updateEntries(pendingTurns, composerKey, (turns) =>
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
    rekey: (from: string, to: string) =>
      set(({ attachments, drafts, markers, pendingTurns, setup, tickets }) => ({
        attachments: rekeyComposerRecord(attachments, from, to),
        drafts: rekeyComposerRecord(drafts, from, to),
        markers: rekeyComposerRecord(markers, from, to),
        pendingTurns: rekeyComposerRecord(pendingTurns, from, to),
        setup: rekeyComposerRecord(setup, from, to),
        tickets: rekeyComposerRecord(tickets, from, to),
      })),
  }
}

export function composerActions(set: ComposerSet) {
  return {
    ...draftActions(set),
    ...attachmentActions(set),
    ...ticketActions(set),
    ...turnActions(set),
  }
}
