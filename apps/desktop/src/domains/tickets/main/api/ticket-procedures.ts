import { randomUUID } from 'node:crypto'
import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import { provider } from '@/domains/accounts/contract/contract'
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
import { updatePriority } from '../priority-service'
import type { Call } from '../read-as'
import {
  connectSource,
  disconnectSource,
  discoverSources,
  listTickets,
  readConnection,
  updateStatus,
} from '../service'
import {
  openTicket,
  readDetail,
  ticketDetailOutputSchema,
  ticketOpenedOutputSchema,
  ticketReference,
} from '../ticket-detail-service'
import {
  readActive,
  requestSync,
  ticketIndexedOutputSchema,
  ticketSyncRequestedOutputSchema,
  watchTickets,
} from '../ticket-index-service'

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
// A numbered page of the saved active list; the bound keeps an offset inside SQLite's reach.
const activeInputSchema = projectInputSchema.extend({ page: z.int().nonnegative().max(100_000) })
const detailInputSchema = projectInputSchema.extend({ reference: ticketReference })
const changeSchema = z.strictObject({ provider, scope: identifierSchema })
const updateStatusInputSchema = projectInputSchema.extend({ key: ticketKey, statusId })
const updateStatusOutputSchema = z.union([ticketUpdatedSchema, ticketErrorSchema])
const updatePriorityInputSchema = projectInputSchema.extend({
  key: ticketKey,
  priorityLevel: priorityLevel.nullable(),
})
const updatePriorityOutputSchema = z.union([ticketPrioritizedSchema, ticketErrorSchema])

export type TicketProcedureContext = Pick<Call, 'access' | 'connections' | 'providers' | 'index'>

function request(dependencies: TicketProcedureContext, projectId: string): Call {
  return { ...dependencies, projectId, requestId: randomUUID() }
}

// The saved Ticket list: reads from SQLite, scan requests, and the commits that change it.
function indexProcedures(dependencies: TicketProcedureContext) {
  return {
    ticketActive: t.procedure
      .input(activeInputSchema)
      .output(ticketIndexedOutputSchema)
      .query(({ input: { projectId, page } }) =>
        readActive(request(dependencies, projectId), page),
      ),
    // One saved Ticket by Argo UUID, native ID or key, listed or not.
    ticketDetail: t.procedure
      .input(detailInputSchema)
      .output(ticketDetailOutputSchema)
      .query(({ input: { projectId, reference } }) =>
        readDetail(request(dependencies, projectId), reference),
      ),
    // Reads one Ticket from the provider by ID and commits it before answering.
    ticketOpen: t.procedure
      .input(detailInputSchema)
      .output(ticketOpenedOutputSchema)
      .mutation(({ input: { projectId, reference } }) =>
        openTicket(request(dependencies, projectId), reference),
      ),
    ticketSync: t.procedure
      .input(projectInputSchema)
      .output(ticketSyncRequestedOutputSchema)
      .mutation(({ input }) => requestSync(request(dependencies, input.projectId))),
    // Open while a view shows the Project's Tickets: main scans them and polls while visible.
    ticketWatch: t.procedure
      .input(projectInputSchema)
      .subscription(({ input }) =>
        observable<never>(() => watchTickets(request(dependencies, input.projectId))),
      ),
    // Sent after each commit to saved Tickets; the renderer then refetches from SQLite.
    ticketChanges: t.procedure.subscription(() =>
      observable<z.infer<typeof changeSchema>>((emit) =>
        dependencies.index.changes.subscribe((target) => emit.next(changeSchema.parse(target))),
      ),
    ),
  }
}

export function ticketProcedures(dependencies: TicketProcedureContext) {
  return {
    ticketConnection: t.procedure
      .input(projectInputSchema)
      .output(connectionOutputSchema)
      .query(({ input }) => readConnection(request(dependencies, input.projectId))),
    ticketList: t.procedure
      .input(listInputSchema)
      .output(listOutputSchema)
      .query(({ input: { projectId, query, cursor } }) =>
        listTickets(request(dependencies, projectId), { query, cursor }),
      ),
    ...indexProcedures(dependencies),
    ticketDiscover: t.procedure
      .input(discoverInputSchema)
      .output(discoverOutputSchema)
      .query(({ input: { projectId, accountId } }) =>
        discoverSources(request(dependencies, projectId), accountId),
      ),
    ticketConnect: t.procedure
      .input(connectInputSchema)
      .output(connectionOutputSchema)
      .mutation(({ input: { projectId, accountId, scope } }) =>
        connectSource(request(dependencies, projectId), { accountId, scope }),
      ),
    ticketDisconnect: t.procedure
      .input(projectInputSchema)
      .output(connectionOutputSchema)
      .mutation(({ input }) => disconnectSource(request(dependencies, input.projectId))),
    ticketUpdateStatus: t.procedure
      .input(updateStatusInputSchema)
      .output(updateStatusOutputSchema)
      .mutation(({ input: { projectId, key, statusId: nextStatusId } }) =>
        updateStatus(request(dependencies, projectId), { key, statusId: nextStatusId }),
      ),
    ticketUpdatePriority: t.procedure
      .input(updatePriorityInputSchema)
      .output(updatePriorityOutputSchema)
      .mutation(({ input: { projectId, key, priorityLevel: nextPriorityLevel } }) =>
        updatePriority(request(dependencies, projectId), {
          key,
          priorityLevel: nextPriorityLevel,
        }),
      ),
  }
}
