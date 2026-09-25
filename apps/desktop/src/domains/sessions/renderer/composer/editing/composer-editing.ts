import type { SessionAttachmentInput } from '@/domains/sessions/api/attachments'
import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

export type ComposerTicketContext =
  RouterInputs['composerDraftCreate']['content']['ticketContext'][number]

export type ComposerAttachment = {
  id: string
  path: string
  status: 'idle' | 'error'
}

export type PendingTurn = {
  id: string
  text: string
  turnConfiguration?: TurnConfiguration
  attachments: SessionAttachmentInput[]
}

export type ComposerEditing = {
  prompt: string
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  pendingTurns: PendingTurn[]
  turnConfiguration: TurnConfiguration | null
}

export function composerEditing(initial: Partial<ComposerEditing> = {}): ComposerEditing {
  return {
    prompt: '',
    attachments: [],
    tickets: [],
    pendingTurns: [],
    turnConfiguration: null,
    ...initial,
  }
}

export type ComposerEditingEvent =
  | { type: 'prompt.changed'; prompt: string }
  | { type: 'attachments.added'; paths: string[]; createId: () => string }
  | { type: 'attachments.failed'; ids: string[] }
  | { type: 'attachment.removed'; id: string }
  | { type: 'attachments.removed'; ids: string[] }
  | {
      type: 'ticket.added'
      ticket: Omit<ComposerTicketContext, 'id'>
      createId: () => string
    }
  | { type: 'pending-turn.added'; turn: PendingTurn }
  | { type: 'pending-turn.removed'; id: string }
  | { type: 'pending-turn.reordered'; sourceId: string; targetId: string }
  | { type: 'turn-configuration.changed'; turnConfiguration: TurnConfiguration }

function addAttachments(
  current: ComposerEditing,
  event: Extract<ComposerEditingEvent, { type: 'attachments.added' }>,
) {
  const known = new Set(current.attachments.map((attachment) => attachment.path))
  const paths = [...new Set(event.paths)]
  return {
    ...current,
    attachments: [
      ...current.attachments.map((attachment) =>
        paths.includes(attachment.path) ? { ...attachment, status: 'idle' as const } : attachment,
      ),
      ...paths
        .filter((path) => !known.has(path))
        .map((path) => ({ id: event.createId(), path, status: 'idle' as const })),
    ],
  }
}

function addTicket(
  current: ComposerEditing,
  event: Extract<ComposerEditingEvent, { type: 'ticket.added' }>,
) {
  const exists = current.tickets.some(
    ({ provider, key }) => provider === event.ticket.provider && key === event.ticket.key,
  )
  return exists
    ? current
    : { ...current, tickets: [...current.tickets, { ...event.ticket, id: event.createId() }] }
}

function reorderPendingTurn(
  current: ComposerEditing,
  event: Extract<ComposerEditingEvent, { type: 'pending-turn.reordered' }>,
) {
  const sourceIndex = current.pendingTurns.findIndex(({ id }) => id === event.sourceId)
  const targetIndex = current.pendingTurns.findIndex(({ id }) => id === event.targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current
  const pendingTurns = [...current.pendingTurns]
  const [source] = pendingTurns.splice(sourceIndex, 1)
  if (source === undefined) return current
  pendingTurns.splice(targetIndex, 0, source)
  return { ...current, pendingTurns }
}

export function editComposer(
  current: ComposerEditing,
  event: ComposerEditingEvent,
): ComposerEditing {
  switch (event.type) {
    case 'prompt.changed':
      return { ...current, prompt: event.prompt }
    case 'attachments.added':
      return addAttachments(current, event)
    case 'attachments.failed':
      return {
        ...current,
        attachments: current.attachments.map((attachment) =>
          event.ids.includes(attachment.id)
            ? { ...attachment, status: 'error' as const }
            : attachment,
        ),
      }
    case 'attachment.removed':
      return {
        ...current,
        attachments: current.attachments.filter((attachment) => attachment.id !== event.id),
      }
    case 'attachments.removed':
      return {
        ...current,
        attachments: current.attachments.filter((attachment) => !event.ids.includes(attachment.id)),
      }
    case 'ticket.added':
      return addTicket(current, event)
    case 'pending-turn.added':
      return { ...current, pendingTurns: [...current.pendingTurns, event.turn] }
    case 'pending-turn.removed':
      return {
        ...current,
        pendingTurns: current.pendingTurns.filter((turn) => turn.id !== event.id),
      }
    case 'pending-turn.reordered':
      return reorderPendingTurn(current, event)
    case 'turn-configuration.changed':
      return { ...current, turnConfiguration: event.turnConfiguration }
  }
}
