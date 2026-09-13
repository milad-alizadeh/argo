// One Ticket as every provider serves it: its key, closure, workflow status, priority and links
// (CONTEXT.md L1 · Ticket). Shared by main and renderer, so it imports neither Electron nor Node.
import { z } from 'zod'

const ticketState = z.enum(['open', 'closed'])
// The provider's own handle: `#607` on GitHub, `ENG-12` on Linear. Unique within a Connection.
export const ticketKey = z.string().min(1).max(64)
const ticketLink = z.strictObject({ key: ticketKey, title: z.string(), state: ticketState })

// A provider's own workflow state, its name drawn verbatim: a Linear team's state, or GitHub's open
// and its reasons for closing. `id` is the provider's handle for moving a Ticket there, and
// `category` is Linear's state type, the one vocabulary a view can style by.
export const statusId = z.string().min(1).max(128)
export const ticketStatus = z.strictObject({
  id: statusId,
  name: z.string().min(1),
  category: z.enum(['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled']),
})
// 1 is the most urgent. A provider with no priority, or a Ticket without one, has null.
export const PRIORITY_LEVELS = [1, 2, 3, 4] as const
const ticketPriority = z.strictObject({
  level: z.literal(PRIORITY_LEVELS),
  label: z.string().min(1),
})

// A label's colour as both providers serve it, six hex digits, drawn as the badge's tint.
const LABEL_COLOR = /^[0-9a-fA-F]{6}$/
export const labelColor = (value: unknown): string | null => {
  const digits = typeof value === 'string' ? value.replace(/^#/, '') : ''
  return LABEL_COLOR.test(digits) ? digits : null
}

export const ticket = z.strictObject({
  key: ticketKey,
  // The provider's page for this Ticket, checked in main to be on the provider's own host.
  url: z.url({ protocol: /^https?$/ }).nullable(),
  title: z.string(),
  body: z.string().nullable(),
  // `state` is the open/closed closure every provider has; `status` is the provider's own word for
  // it, which Linear keeps per team and GitHub keeps as open or a reason for closing.
  state: ticketState,
  status: ticketStatus,
  priority: ticketPriority.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  labels: z.array(
    z.strictObject({ name: z.string(), color: z.string().regex(LABEL_COLOR).nullable() }),
  ),
  type: z.string().nullable(),
  children: z.array(ticketLink),
  // Null where the provider serves no dependency facts at all, which is not a Ticket nothing blocks.
  blockedBy: z.array(ticketLink).nullable(),
})

// A Ticket whose status falls in one of these categories is closed, on every provider.
const CLOSED_CATEGORIES: ReadonlySet<TicketStatus['category']> = new Set(['completed', 'canceled'])
export const closureOf = (category: TicketStatus['category']): TicketState =>
  CLOSED_CATEGORIES.has(category) ? 'closed' : 'open'

// Moving one Ticket of a Connection's scope to one of the statuses its listing offered.
export type StatusChange = { scope: string; key: string; statusId: string }

export type TicketState = z.infer<typeof ticketState>
export type TicketLink = z.infer<typeof ticketLink>
export type TicketStatus = z.infer<typeof ticketStatus>
export type TicketPriority = z.infer<typeof ticketPriority>
export type TicketLabel = Ticket['labels'][number]
export type Ticket = z.infer<typeof ticket>
