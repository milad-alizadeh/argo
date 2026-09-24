import {
  ticketConnectedSchema,
  ticketConnectionRequestSchema,
  ticketConnectRequestSchema,
  ticketDisconnectRequestSchema,
  ticketDiscoveredSchema,
  ticketDiscoverRequestSchema,
  ticketErrorSchema,
  ticketListedSchema,
  ticketListRequestSchema,
  ticketPrioritizedSchema,
  ticketPriorityRequestSchema,
  ticketReadRequestSchema,
  ticketReadSchema,
  ticketUpdatedSchema,
  ticketUpdateRequestSchema,
} from './contract'

// The Ticket IPC contract has eight named operations, each on its own channel. The table is
// consumed by the client, the preload bridge and the main-process registration, so an operation
// cannot acquire a second hand-maintained channel.
export const TICKET_OPERATIONS = {
  connection: {
    name: 'ticket.connection',
    channel: 'argo:ticket:connection',
    request: ticketConnectionRequestSchema,
    reply: ticketConnectedSchema.or(ticketErrorSchema),
  },
  connect: {
    name: 'ticket.connect',
    channel: 'argo:ticket:connect',
    request: ticketConnectRequestSchema,
    reply: ticketConnectedSchema.or(ticketErrorSchema),
  },
  disconnect: {
    name: 'ticket.disconnect',
    channel: 'argo:ticket:disconnect',
    request: ticketDisconnectRequestSchema,
    reply: ticketConnectedSchema.or(ticketErrorSchema),
  },
  discover: {
    name: 'ticket.discover',
    channel: 'argo:ticket:discover',
    request: ticketDiscoverRequestSchema,
    reply: ticketDiscoveredSchema.or(ticketErrorSchema),
  },
  list: {
    name: 'ticket.list',
    channel: 'argo:ticket:list',
    request: ticketListRequestSchema,
    reply: ticketListedSchema.or(ticketErrorSchema),
  },
  read: {
    name: 'ticket.read',
    channel: 'argo:ticket:read',
    request: ticketReadRequestSchema,
    reply: ticketReadSchema.or(ticketErrorSchema),
  },
  update: {
    name: 'ticket.update',
    channel: 'argo:ticket:update',
    request: ticketUpdateRequestSchema,
    reply: ticketUpdatedSchema.or(ticketErrorSchema),
  },
  priority: {
    name: 'ticket.priority',
    channel: 'argo:ticket:priority',
    request: ticketPriorityRequestSchema,
    reply: ticketPrioritizedSchema.or(ticketErrorSchema),
  },
} as const
