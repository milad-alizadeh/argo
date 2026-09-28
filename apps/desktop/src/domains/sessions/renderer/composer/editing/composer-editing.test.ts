import { expect, test } from 'bun:test'
import { composerEditing, editComposer } from './composer-editing'

test('the active draft keeps one attachment per path', () => {
  const attached = editComposer(composerEditing(), {
    type: 'attachments.added',
    paths: ['/repo/notes.md', '/repo/notes.md'],
    createId: () => 'attachment-1',
  })
  const reattached = editComposer(attached, {
    type: 'attachments.added',
    paths: ['/repo/notes.md'],
    createId: () => 'unused',
  })

  expect(reattached).toBe(attached)
  expect(reattached.attachments).toEqual([{ id: 'attachment-1', path: '/repo/notes.md' }])
  expect(
    editComposer(reattached, { type: 'attachment.removed', id: 'attachment-1' }).attachments,
  ).toEqual([])
})

test('the active draft owns its prompt and keeps one reference per Ticket', () => {
  const prompted = editComposer(composerEditing(), {
    type: 'prompt.changed',
    prompt: 'Fix the draft.',
  })
  const ticket = {
    provider: 'github' as const,
    key: '2750',
    title: 'Composer drafts',
    status: 'open',
    terminal: false,
    blocked: null,
  }
  const referenced = editComposer(prompted, {
    type: 'ticket.added',
    ticket,
    createId: () => 'ticket-1',
  })
  const duplicate = editComposer(referenced, {
    type: 'ticket.added',
    ticket,
    createId: () => 'unused',
  })

  expect(duplicate.prompt).toBe('Fix the draft.')
  expect(duplicate.tickets).toEqual([{ ...ticket, id: 'ticket-1' }])
})

test('the selected Turn configuration is part of the active durable draft', () => {
  const turnConfiguration = { model: 'gpt-6', effort: 'high', mode: 'workspace-write' }
  const edited = editComposer(composerEditing(), {
    type: 'turn-configuration.changed',
    turnConfiguration,
  })

  expect(edited.turnConfiguration).toEqual(turnConfiguration)
})
