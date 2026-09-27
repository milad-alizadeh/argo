import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

export type ComposerTicketContext =
  RouterInputs['composerDraftCreate']['content']['ticketContext'][number]

export type ComposerAttachment = {
  id: string
  path: string
  status: 'idle' | 'error'
}

export type ComposerEditing = {
  prompt: string
  attachments: ComposerAttachment[]
  tickets: ComposerTicketContext[]
  turnConfiguration: TurnConfiguration | null
}

export function composerEditing(initial: Partial<ComposerEditing> = {}): ComposerEditing {
  return {
    prompt: '',
    attachments: [],
    tickets: [],
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
    case 'turn-configuration.changed':
      return { ...current, turnConfiguration: event.turnConfiguration }
  }
}
