import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { initTRPC } from '@trpc/server'
import type { Database } from '@/database/database'
import { createAccountAccess } from '@/domains/accounts/main'
import type { Cipher } from '@/domains/accounts/main/grants'
import { createConnectionPort } from '@/domains/connections/main'
import { providerEndpoints } from '@/providers/endpoints'
import { PROVIDER_REGISTRY } from '@/providers/registry'
import { TicketChanges } from '../sync/ticket-changes'
import { ticketProcedures } from './ticket-procedures'

const cipher: Cipher = {
  available: () => true,
  encrypt: (text) => Buffer.from(text),
  decrypt: (data) => data.toString(),
}

async function caller(context: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-procedures-'))
  context.after(() => rm(directory, { force: true, recursive: true }))
  const access = createAccountAccess({
    userData: directory,
    accountData: directory,
    endpoints: providerEndpoints(false),
    providers: PROVIDER_REGISTRY,
    cipher,
    openExternal: async () => {},
  })
  return initTRPC
    .create()
    .router(
      ticketProcedures({
        access,
        connections: createConnectionPort({
          path: access.paths.connections,
          exclusive: access.exclusive,
        }),
        providers: PROVIDER_REGISTRY,
        // These cases are refused before any saved Ticket is read.
        index: {
          database: {} as Database,
          changes: new TicketChanges(),
          send: () => {},
          changeStatus: async () => ({ type: 'rejected', failure: 'not-connected' }),
        },
      }),
    )
    .createCaller({})
}

test('the Ticket procedures rejects malformed input before reading a domain owner', async (context) => {
  const tickets = await caller(context)
  await assert.rejects(tickets.ticketConnection({ projectId: '' }))
})

test('the Ticket procedures preserves a structured domain refusal', async (context) => {
  const tickets = await caller(context)
  const reply = await tickets.ticketList({ projectId: 'project-one', query: '', cursor: null })
  assert.equal(reply.type, 'ticket.error')
  if (reply.type === 'ticket.error') assert.equal(reply.code, 'not-connected')
})
