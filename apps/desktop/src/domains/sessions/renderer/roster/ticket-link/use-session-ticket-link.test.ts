import { expect, test } from 'bun:test'
import { connectTicket, disconnectTicket } from './use-session-ticket-link'
import { mockArgo, session, TICKET } from './use-session-ticket-link-fixtures'

test('connecting a Ticket renames a first-prompt Session without asking', async () => {
  const argo = mockArgo()
  const result = await connectTicket({ argo, session: session('first-prompt'), ticket: TICKET })
  expect(result.outcome).toEqual({
    failure: null,
    renamed: true,
    needsRenameConfirmation: false,
    renameFailure: null,
  })
  expect(argo.calls.connectSessionTicket).toEqual([{ sessionId: 'session-1', ...TICKET }])
  expect(argo.calls.renameSession).toEqual([{ sessionId: 'session-1', name: TICKET.title }])
})

test('connecting a Ticket renames a summarised Session without asking', async () => {
  const argo = mockArgo()
  const result = await connectTicket({ argo, session: session('summarised'), ticket: TICKET })
  expect(result.outcome.renamed).toBe(true)
})

test('renames an already-linked Session without writing the link again', async () => {
  const argo = mockArgo()
  const existing = {
    ...session('custom'),
    ticket: {
      projectId: TICKET.projectId,
      key: TICKET.key,
      title: 'Old Ticket title',
      state: 'open' as const,
      createdAt: '2026-09-23T00:00:00.000Z',
    },
  }

  const result = await connectTicket({
    argo,
    session: existing,
    ticket: TICKET,
    confirmedRename: true,
  })

  expect(result.outcome.renamed).toBe(true)
  expect(argo.calls.connectSessionTicket).toEqual([])
  expect(argo.calls.renameSession).toEqual([{ sessionId: 'session-1', name: TICKET.title }])
})

test('connecting a Ticket with a custom title asks before renaming', async () => {
  const argo = mockArgo()
  const result = await connectTicket({ argo, session: session('custom'), ticket: TICKET })
  expect(result.outcome).toEqual({
    failure: null,
    renamed: false,
    needsRenameConfirmation: true,
    renameFailure: null,
  })
  expect(argo.calls.connectSessionTicket).toEqual([])
  expect(argo.calls.renameSession).toEqual([])
})

test('a confirmed rename on a custom title links and renames', async () => {
  const argo = mockArgo()
  const result = await connectTicket({
    argo,
    session: session('custom'),
    ticket: TICKET,
    confirmedRename: true,
  })
  expect(result.outcome.renamed).toBe(true)
  expect(argo.calls.connectSessionTicket).toHaveLength(1)
})

test('refusing the rename on a custom title keeps the name', async () => {
  const argo = mockArgo()
  const asked = await connectTicket({ argo, session: session('custom'), ticket: TICKET })
  expect(asked.outcome.needsRenameConfirmation).toBe(true)
  // A refusal never calls connect again with confirmedRename: true; the caller simply stops.
  expect(argo.calls.connectSessionTicket).toEqual([])
  expect(argo.calls.renameSession).toEqual([])
})

test('connecting a Ticket while a Turn is running renames the Session', async () => {
  const argo = mockArgo()
  const result = await connectTicket({
    argo,
    session: session('first-prompt', 'running'),
    ticket: TICKET,
  })
  expect(argo.calls.connectSessionTicket).toHaveLength(1)
  expect(argo.calls.renameSession).toEqual([{ sessionId: 'session-1', name: TICKET.title }])
  expect(result.outcome).toEqual({
    failure: null,
    renamed: true,
    needsRenameConfirmation: false,
    renameFailure: null,
  })
  expect(result.invalidate).toBe(true)
})

test('a link write that the Harness refuses never calls rename', async () => {
  const argo = mockArgo({
    connectSessionTicket: { type: 'session.error', code: 'unavailable', message: 'no ticket' },
  })
  const result = await connectTicket({ argo, session: session('first-prompt'), ticket: TICKET })
  expect(result.failure).toBe('no ticket')
  expect(result.outcome.failure).toBe('no ticket')
  expect(argo.calls.renameSession).toEqual([])
  expect(result.invalidate).toBe(false)
})

test('a rename the Harness refuses leaves the link in place and reports the failure', async () => {
  const argo = mockArgo({
    renameSession: { type: 'session.error', code: 'unavailable', message: 'Harness busy' },
  })
  const result = await connectTicket({ argo, session: session('first-prompt'), ticket: TICKET })
  expect(argo.calls.connectSessionTicket).toHaveLength(1)
  expect(result.outcome).toEqual({
    failure: null,
    renamed: false,
    needsRenameConfirmation: false,
    renameFailure: 'Harness busy',
  })
  // The link write already happened above and is never undone by the rename failing.
  expect(result.invalidate).toBe(true)
})

test('disconnecting a Ticket never renames the Session', async () => {
  const argo = mockArgo()
  const result = await disconnectTicket(argo, 'session-1')
  expect(result).toEqual({ failure: null, invalidate: true })
  expect(argo.calls.renameSession).toEqual([])
})
