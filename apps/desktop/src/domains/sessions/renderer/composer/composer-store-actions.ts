import type { StoreApi } from 'zustand'
import { draftActions } from '@/domains/sessions/renderer/composer/composer-draft-actions'
import { updateComposerEntries } from '@/domains/sessions/renderer/composer/composer-entry-records'
import { turnActions } from '@/domains/sessions/renderer/composer/composer-turn-actions'
import type { ComposerState } from '@/domains/sessions/renderer/composer/use-composer-store'

type ComposerSet = StoreApi<ComposerState>['setState']

function attachmentActions(set: ComposerSet) {
  return {
    addAttachments: (composerKey: string, paths: string[]) =>
      set(({ attachments }) => ({
        attachments: updateComposerEntries(attachments, composerKey, (current) => {
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
        attachments: updateComposerEntries(attachments, composerKey, (current) =>
          current.filter((item) => item.id !== id),
        ),
      })),
    markAttachmentsError: (composerKey: string, ids: string[]) =>
      set(({ attachments }) => ({
        attachments: updateComposerEntries(attachments, composerKey, (current) =>
          current.map((attachment) =>
            ids.includes(attachment.id) ? { ...attachment, status: 'error' } : attachment,
          ),
        ),
      })),
    removeAttachments: (composerKey: string, ids: string[]) =>
      set(({ attachments }) => ({
        attachments: updateComposerEntries(attachments, composerKey, (current) =>
          current.filter((attachment) => !ids.includes(attachment.id)),
        ),
      })),
    removeAttachmentPaths: (composerKey: string, paths: string[]) =>
      set(({ attachments }) => ({
        attachments: updateComposerEntries(attachments, composerKey, (current) =>
          current.filter((attachment) => !paths.includes(attachment.path)),
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
        tickets: updateComposerEntries(tickets, composerKey, (current) =>
          current.filter((ticket) => ticket.id !== id),
        ),
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
