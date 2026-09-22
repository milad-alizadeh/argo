import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sessionAttachmentInputSchema } from '@/domains/sessions/contract/drive/attachments-contract'
import type { TurnMarkerEntry } from '../../feed/rows/turn-marker-state'
import { SESSION_HARNESSES, type SessionHarness } from '../../harness/harnesses'
import { composerActions } from '../store/composer-store-actions'
import { type ComposerTicketContext, ticketContextSchema } from '../store/composer-ticket-context'
import type { TurnSetup } from '../turn-setup/turn-setup'

export type { ComposerTicketContext } from '../store'

// A path the user attached. `error` means the file was unreadable the last time it was checked
// (typically at Send), so it stays in the strip for the user to fix or remove rather than being
// sent silently.
export type ComposerAttachment = {
  id: string
  path: string
  status: 'idle' | 'error'
}

export type PendingTurn = {
  id: string
  text: string
  setup?: TurnSetup
  attachments: import('@/domains/sessions/contract/drive').SessionAttachmentInput[]
}

const attachmentSchema = z.object({
  id: z.string(),
  path: z.string(),
  status: z.enum(['idle', 'error']),
})

const pendingTurnSchema = z
  .strictObject({
    id: z.string().uuid(),
    text: z.string(),
    setup: z.strictObject({ model: z.string(), effort: z.string(), mode: z.string() }).optional(),
    attachments: z.array(sessionAttachmentInputSchema).default([]),
  })
  .refine(({ text, attachments }) => text.trim().length > 0 || attachments.length > 0)

// What a composer keeps across leaving the page and relaunching: each composer's unsent draft and
// attachments, and the harness the last new Session was set to, app-wide.
export type ComposerState = {
  harness: SessionHarness
  drafts: Record<string, string>
  attachments: Record<string, ComposerAttachment[]>
  tickets: Record<string, ComposerTicketContext[]>
  pendingTurns: Record<string, PendingTurn[]>
  markers: Record<string, TurnMarkerEntry>
  setup: Record<string, TurnSetup>
  chooseHarness: (harness: SessionHarness) => void
  setDraft: (composerKey: string, text: string) => void
  addAttachments: (composerKey: string, paths: string[]) => void
  removeAttachment: (composerKey: string, id: string) => void
  markAttachmentsError: (composerKey: string, ids: string[]) => void
  removeAttachments: (composerKey: string, ids: string[]) => void
  removeAttachmentPaths: (composerKey: string, paths: string[]) => void
  addTicket: (composerKey: string, ticket: Omit<ComposerTicketContext, 'id'>) => void
  removeTicket: (composerKey: string, id: string) => void
  chooseSetup: (composerKey: string, setup: TurnSetup) => void
  addPendingTurn: (composerKey: string, turn: PendingTurn) => void
  removePendingTurn: (composerKey: string, id: string) => void
  reorderPendingTurn: (composerKey: string, sourceId: string, targetId: string) => void
  beginMarker: (composerKey: string, marker: TurnMarkerEntry) => void
  clearMarker: (composerKey: string) => void
  rekey: (from: string, to: string) => void
}

const storedSchema = z
  .object({
    harness: z.enum(SESSION_HARNESSES),
    drafts: z.record(z.string(), z.string()),
    attachments: z.record(z.string(), z.array(attachmentSchema)),
    pendingTurns: z.record(z.string(), z.array(pendingTurnSchema)),
    tickets: z.record(z.string(), z.array(ticketContextSchema)),
  })
  .partial()

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

export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      harness: 'claude',
      drafts: {},
      attachments: {},
      tickets: {},
      pendingTurns: {},
      markers: {},
      setup: {},
      ...composerActions(set),
    }),
    {
      name: 'argo.composer',
      storage: createJSONStorage(() => composerStorage),
      partialize: ({ harness, drafts, attachments, pendingTurns, tickets }) => ({
        harness,
        drafts,
        attachments,
        pendingTurns,
        tickets,
      }),
      merge: (stored, current) => ({ ...current, ...storedSchema.safeParse(stored).data }),
    },
  ),
)
