import { create } from 'zustand'
import type { TurnMarkerEntry } from '../../feed/rows/turn-marker-state'
import type { SessionHarness } from '../../harness/harnesses'
import { composerActions } from '../store/composer-store-actions'
import type { ComposerTicketContext } from '../store/composer-ticket-context'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

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
  turnConfiguration?: TurnConfiguration
  attachments: import('@/domains/sessions/api/attachments').SessionAttachmentInput[]
}

export const EMPTY_COMPOSER_ATTACHMENTS: ComposerAttachment[] = []
export const EMPTY_COMPOSER_TICKETS: ComposerTicketContext[] = []
export const EMPTY_PENDING_TURNS: PendingTurn[] = []

export type ComposerState = {
  harness: SessionHarness
  rememberedTurnConfiguration: Partial<
    Record<SessionHarness, Pick<TurnConfiguration, 'model' | 'effort'>>
  >
  drafts: Record<string, string>
  attachments: Record<string, ComposerAttachment[]>
  tickets: Record<string, ComposerTicketContext[]>
  pendingTurns: Record<string, PendingTurn[]>
  markers: Record<string, TurnMarkerEntry>
  turnConfiguration: Record<string, TurnConfiguration>
  chooseHarness: (harness: SessionHarness) => void
  rememberTurnConfiguration: (
    harness: SessionHarness,
    turnConfiguration: Pick<TurnConfiguration, 'model' | 'effort'>,
  ) => void
  setDraft: (composerKey: string, text: string) => void
  addAttachments: (composerKey: string, paths: string[]) => void
  removeAttachment: (composerKey: string, id: string) => void
  markAttachmentsError: (composerKey: string, ids: string[]) => void
  removeAttachments: (composerKey: string, ids: string[]) => void
  removeAttachmentPaths: (composerKey: string, paths: string[]) => void
  addTicket: (composerKey: string, ticket: Omit<ComposerTicketContext, 'id'>) => void
  removeTicket: (composerKey: string, id: string) => void
  chooseTurnConfiguration: (composerKey: string, turnConfiguration: TurnConfiguration) => void
  addPendingTurn: (composerKey: string, turn: PendingTurn) => void
  removePendingTurn: (composerKey: string, id: string) => void
  reorderPendingTurn: (composerKey: string, sourceId: string, targetId: string) => void
  beginMarker: (composerKey: string, marker: TurnMarkerEntry) => void
  clearMarker: (composerKey: string) => void
  rekey: (from: string, to: string) => void
}

export const useComposerStore = create<ComposerState>()((set) => ({
  harness: 'claude',
  rememberedTurnConfiguration: {},
  drafts: {},
  attachments: {},
  tickets: {},
  pendingTurns: {},
  markers: {},
  turnConfiguration: {},
  ...composerActions(set),
}))
