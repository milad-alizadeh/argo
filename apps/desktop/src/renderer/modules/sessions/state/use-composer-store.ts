import { z } from 'zod'
import { create, type StoreApi } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { SESSION_CLIS, type SessionCli } from '../harness/harnesses'
import { type ComposerTicketContext, ticketContextSchema } from './composer-ticket-context'

export type { ComposerTicketContext } from './composer-ticket-context'

// A path the user attached. `error` means the file was unreadable the last time it was checked
// (typically at Send), so it stays in the strip for the user to fix or remove rather than being
// sent silently.
export type ComposerAttachment = {
  id: string
  path: string
  status: 'idle' | 'error'
}

const attachmentSchema = z.object({
  id: z.string(),
  path: z.string(),
  status: z.enum(['idle', 'error']),
})

// What a composer keeps across leaving the page and relaunching: each composer's unsent draft and
// attachments, and the harness the last new Session was set to, app-wide.
type ComposerState = {
  harness: SessionCli
  drafts: Record<string, string>
  attachments: Record<string, ComposerAttachment[]>
  tickets: Record<string, ComposerTicketContext[]>
  chooseHarness: (harness: SessionCli) => void
  setDraft: (composerKey: string, text: string) => void
  addAttachments: (composerKey: string, paths: string[]) => void
  removeAttachment: (composerKey: string, id: string) => void
  markAttachmentsError: (composerKey: string, ids: string[]) => void
  removeAttachments: (composerKey: string, ids: string[]) => void
  addTicket: (composerKey: string, ticket: Omit<ComposerTicketContext, 'id'>) => void
  removeTicket: (composerKey: string, id: string) => void
}

const storedSchema = z
  .object({
    harness: z.enum(SESSION_CLIS),
    drafts: z.record(z.string(), z.string()),
    attachments: z.record(z.string(), z.array(attachmentSchema)),
    tickets: z.record(z.string(), z.array(ticketContextSchema)),
  })
  .partial()

function updateAttachments(
  attachments: Record<string, ComposerAttachment[]>,
  composerKey: string,
  update: (current: ComposerAttachment[]) => ComposerAttachment[],
): Record<string, ComposerAttachment[]> {
  const updated = update(attachments[composerKey] ?? [])
  if (updated.length === 0) {
    const { [composerKey]: _replaced, ...others } = attachments
    return others
  }
  return { ...attachments, [composerKey]: updated }
}

// A test runs this module with no `localStorage`, and the default storage says so on every write.
// The drafts are the window's to keep, so a run without one keeps them for its own length.
const composerStorage: Storage = globalThis.localStorage ?? {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
}

type ComposerSet = StoreApi<ComposerState>['setState']

function attachmentActions(set: ComposerSet) {
  return {
    addAttachments: (composerKey: string, paths: string[]) =>
      set(({ attachments }) => ({
        attachments: updateAttachments(attachments, composerKey, (current) => {
          const known = new Set(current.map((attachment) => attachment.path))
          const reattached = new Set(paths.filter((path) => known.has(path)))
          const added = paths
            .filter((path) => !known.has(path))
            .map((path) => ({ id: crypto.randomUUID(), path, status: 'idle' as const }))
          const retried = current.map((attachment) =>
            reattached.has(attachment.path)
              ? { ...attachment, status: 'idle' as const }
              : attachment,
          )
          return [...retried, ...added]
        }),
      })),
    removeAttachment: (composerKey: string, id: string) =>
      set(({ attachments }) => ({
        attachments: updateAttachments(attachments, composerKey, (current) =>
          current.filter((attachment) => attachment.id !== id),
        ),
      })),
    markAttachmentsError: (composerKey: string, ids: string[]) =>
      set(({ attachments }) => ({
        attachments: updateAttachments(attachments, composerKey, (current) =>
          current.map((attachment) =>
            ids.includes(attachment.id) ? { ...attachment, status: 'error' } : attachment,
          ),
        ),
      })),
    removeAttachments: (composerKey: string, ids: string[]) =>
      set(({ attachments }) => ({
        attachments: updateAttachments(attachments, composerKey, (current) =>
          current.filter((attachment) => !ids.includes(attachment.id)),
        ),
      })),
  }
}

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      harness: 'claude',
      drafts: {},
      attachments: {},
      tickets: {},
      chooseHarness: (harness) => set({ harness }),
      setDraft: (composerKey, text) =>
        set(({ drafts }) => {
          const { [composerKey]: _replaced, ...others } = drafts
          return { drafts: text === '' ? others : { ...others, [composerKey]: text } }
        }),
      ...attachmentActions(set),
      addTicket: (composerKey, ticket) =>
        set(({ tickets }) => {
          const current = tickets[composerKey] ?? []
          if (
            current.some(({ provider, key }) => provider === ticket.provider && key === ticket.key)
          )
            return { tickets }
          return {
            tickets: {
              ...tickets,
              [composerKey]: [...current, { ...ticket, id: crypto.randomUUID() }],
            },
          }
        }),
      removeTicket: (composerKey, id) =>
        set(({ tickets }) => {
          const remaining = (tickets[composerKey] ?? []).filter((ticket) => ticket.id !== id)
          if (remaining.length > 0) return { tickets: { ...tickets, [composerKey]: remaining } }
          const { [composerKey]: _removed, ...others } = tickets
          return { tickets: others }
        }),
    }),
    {
      name: 'argo.composer',
      storage: createJSONStorage(() => composerStorage),
      partialize: ({ harness, drafts, attachments, tickets }) => ({
        harness,
        drafts,
        attachments,
        tickets,
      }),
      merge: (stored, current) => ({ ...current, ...storedSchema.safeParse(stored).data }),
    },
  ),
)
