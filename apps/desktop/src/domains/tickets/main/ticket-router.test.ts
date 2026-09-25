import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import { createAccountAccess } from '@/domains/accounts/main'
import type { Cipher } from '@/domains/accounts/main/grants'
import { createConnectionPort } from '@/domains/connections/main'
import { accountProviders, ticketSources } from '@/providers/composition'
import { providerEndpoints } from '@/providers/endpoints'
import { createTicketRouter } from './ticket-router'

const cipher: Cipher = {
  available: () => true,
  encrypt: (text) => Buffer.from(text),
  decrypt: (data) => data.toString(),
}

async function caller(context: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-ticket-router-'))
  context.after(() => rm(directory, { force: true, recursive: true }))
  const access = createAccountAccess({
    userData: directory,
    accountData: directory,
    endpoints: providerEndpoints(false),
    providers: accountProviders,
    cipher,
    openExternal: async () => {},
  })
  return createTicketRouter({
    access,
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    sources: ticketSources,
  }).createCaller({})
}

test('the Ticket router rejects malformed input before reading a domain owner', async (context) => {
  const tickets = await caller(context)
  await assert.rejects(tickets.connection({ projectId: '' }))
})

test('the Ticket router preserves a structured domain refusal', async (context) => {
  const tickets = await caller(context)
  const reply = await tickets.list({ projectId: 'project-one', query: '', cursor: null })
  assert.equal(reply.type, 'ticket.error')
  if (reply.type === 'ticket.error') assert.equal(reply.code, 'not-connected')
})
