import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import {
  TICKET_QUERY_LIMIT,
  ticketConnectedSchema,
  ticketDiscoveredSchema,
  ticketErrorSchema,
  ticketListedSchema,
  ticketPrioritizedSchema,
  ticketUpdatedSchema,
} from '@/domains/tickets/contract/contract'
import { priorityLevel, statusId, ticketKey } from '@/domains/tickets/contract/ticket'
import { identifierSchema } from '@/shared/validation'
import { updatePriority } from './priority-service'
import type { Call } from './read-as'
import {
  connectSource,
  disconnectSource,
  discoverSources,
  listTickets,
  readConnection,
  updateStatus,
} from './service'

const t = initTRPC.create()
const projectInputSchema = z.strictObject({ projectId: identifierSchema })
const connectionOutputSchema = z.union([ticketConnectedSchema, ticketErrorSchema])
const discoverInputSchema = projectInputSchema.extend({ accountId: identifierSchema })
const discoverOutputSchema = z.union([ticketDiscoveredSchema, ticketErrorSchema])
const connectInputSchema = discoverInputSchema.extend({ scope: identifierSchema })
const cursorSchema = z.string().min(1).max(512).nullable()
const listInputSchema = projectInputSchema.extend({
  query: z.string().max(TICKET_QUERY_LIMIT),
  cursor: cursorSchema,
})
const listOutputSchema = z.union([ticketListedSchema, ticketErrorSchema])
const updateStatusInputSchema = projectInputSchema.extend({ key: ticketKey, statusId })
const updateStatusOutputSchema = z.union([ticketUpdatedSchema, ticketErrorSchema])
const updatePriorityInputSchema = projectInputSchema.extend({
  key: ticketKey,
  priorityLevel: priorityLevel.nullable(),
})
const updatePriorityOutputSchema = z.union([ticketPrioritizedSchema, ticketErrorSchema])

export type TicketRouterDependencies = Pick<Call, 'access' | 'connections' | 'sources'>

function request(dependencies: TicketRouterDependencies, projectId: string): Call {
  return { ...dependencies, projectId, requestId: randomUUID() }
}

export function createTicketRouter(dependencies: TicketRouterDependencies) {
  return t.router({
    connection: t.procedure
      .input(projectInputSchema)
      .output(connectionOutputSchema)
      .query(({ input }) => readConnection(request(dependencies, input.projectId))),
    list: t.procedure
      .input(listInputSchema)
      .output(listOutputSchema)
      .query(({ input: { projectId, query, cursor } }) =>
        listTickets(request(dependencies, projectId), { query, cursor }),
      ),
    discover: t.procedure
      .input(discoverInputSchema)
      .output(discoverOutputSchema)
      .query(({ input: { projectId, accountId } }) =>
        discoverSources(request(dependencies, projectId), accountId),
      ),
    connect: t.procedure
      .input(connectInputSchema)
      .output(connectionOutputSchema)
      .mutation(({ input: { projectId, accountId, scope } }) =>
        connectSource(request(dependencies, projectId), { accountId, scope }),
      ),
    disconnect: t.procedure
      .input(projectInputSchema)
      .output(connectionOutputSchema)
      .mutation(({ input }) => disconnectSource(request(dependencies, input.projectId))),
    updateStatus: t.procedure
      .input(updateStatusInputSchema)
      .output(updateStatusOutputSchema)
      .mutation(({ input: { projectId, key, statusId: nextStatusId } }) =>
        updateStatus(request(dependencies, projectId), { key, statusId: nextStatusId }),
      ),
    updatePriority: t.procedure
      .input(updatePriorityInputSchema)
      .output(updatePriorityOutputSchema)
      .mutation(({ input: { projectId, key, priorityLevel: nextPriorityLevel } }) =>
        updatePriority(request(dependencies, projectId), {
          key,
          priorityLevel: nextPriorityLevel,
        }),
      ),
  })
}

export type TicketRouter = ReturnType<typeof createTicketRouter>
