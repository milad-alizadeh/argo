import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

export type ComposerTicketContext =
  RouterInputs['composerDraftCreate']['content']['ticketContext'][number]

export type ComposerAttachment = {
  id: string
  path: string
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
  | { type: 'send.accepted'; sentIds: string[] }
  | { type: 'attachments.added'; paths: string[]; createId: () => string }
  | { type: 'attachment.removed'; id: string }
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
  const added = paths
    .filter((path) => !known.has(path))
    .map((path) => ({ id: event.createId(), path }))
  if (added.length === 0) return current
  return {
    ...current,
    attachments: [...current.attachments, ...added],
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
    case 'send.accepted':
      return {
        ...current,
        prompt: '',
        attachments: current.attachments.filter(
          (attachment) => !event.sentIds.includes(attachment.id),
        ),
      }
    case 'attachments.added':
      return addAttachments(current, event)
    case 'attachment.removed':
      return {
        ...current,
        attachments: current.attachments.filter((attachment) => attachment.id !== event.id),
      }
    case 'ticket.added':
      return addTicket(current, event)
    case 'turn-configuration.changed':
      return { ...current, turnConfiguration: event.turnConfiguration }
  }
}
