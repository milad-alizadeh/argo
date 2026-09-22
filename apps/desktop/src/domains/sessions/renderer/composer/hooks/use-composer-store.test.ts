import { beforeEach, describe, expect, test } from 'bun:test'

import { useComposerStore } from './use-composer-store'

beforeEach(() => {
  useComposerStore.setState(useComposerStore.getInitialState())
})

describe('composer attachments', () => {
  test('attaching the same path twice keeps one entry', () => {
    useComposerStore.getState().addAttachments('session-one', ['/repo/notes.md'])
    useComposerStore.getState().addAttachments('session-one', ['/repo/notes.md'])
    expect(useComposerStore.getState().attachments['session-one']).toHaveLength(1)
  })

  test('removing an attachment leaves the draft text untouched', () => {
    useComposerStore.getState().setDraft('session-one', 'Half a thought.')
    useComposerStore.getState().addAttachments('session-one', ['/repo/notes.md'])
    const [attachment] = useComposerStore.getState().attachments['session-one'] ?? []
    if (!attachment) throw new Error('Expected an attachment')

    useComposerStore.getState().removeAttachment('session-one', attachment.id)

    expect(useComposerStore.getState().attachments['session-one']).toBeUndefined()
    expect(useComposerStore.getState().drafts['session-one']).toBe('Half a thought.')
  })

  test('attachments for one Session survive switching to another and back', () => {
    useComposerStore.getState().addAttachments('session-one', ['/repo/notes.md'])
    useComposerStore.getState().addAttachments('session-two', ['/repo/workspace.jpg'])

    expect(useComposerStore.getState().attachments['session-one']).toHaveLength(1)
    expect(useComposerStore.getState().attachments['session-two']).toHaveLength(1)
  })

  test('marking an attachment errored keeps it, rather than removing it', () => {
    useComposerStore.getState().addAttachments('session-one', ['/repo/gone.md'])
    const [attachment] = useComposerStore.getState().attachments['session-one'] ?? []
    if (!attachment) throw new Error('Expected an attachment')

    useComposerStore.getState().markAttachmentsError('session-one', [attachment.id])

    expect(useComposerStore.getState().attachments['session-one']).toEqual([
      { ...attachment, status: 'error' },
    ])
  })

  test('re-attaching a failed path clears its error, rather than being ignored as a duplicate', () => {
    useComposerStore.getState().addAttachments('session-one', ['/repo/gone.md'])
    const [attachment] = useComposerStore.getState().attachments['session-one'] ?? []
    if (!attachment) throw new Error('Expected an attachment')
    useComposerStore.getState().markAttachmentsError('session-one', [attachment.id])

    useComposerStore.getState().addAttachments('session-one', ['/repo/gone.md'])

    expect(useComposerStore.getState().attachments['session-one']).toEqual([
      { ...attachment, status: 'idle' },
    ])
  })

  test('removeAttachments clears every sent attachment at once', () => {
    useComposerStore.getState().addAttachments('session-one', ['/repo/a.md', '/repo/b.md'])
    const ids = (useComposerStore.getState().attachments['session-one'] ?? []).map((a) => a.id)

    useComposerStore.getState().removeAttachments('session-one', ids)

    expect(useComposerStore.getState().attachments['session-one']).toBeUndefined()
  })

  test('removing accepted attachment paths leaves unreadable attachments in the composer', () => {
    useComposerStore
      .getState()
      .addAttachments('session-one', ['/repo/readable.md', '/repo/gone.md'])

    useComposerStore.getState().removeAttachmentPaths('session-one', ['/repo/readable.md'])

    expect(useComposerStore.getState().attachments['session-one']).toMatchObject([
      { path: '/repo/gone.md' },
    ])
  })
})

// A draft is keyed by the composer's identity, so it survives under a draft key even though no
// Session exists yet, and is invisible under any Session id.
test('a draft survives before a Session exists, keyed by its own identity', () => {
  useComposerStore.getState().setDraft('new:project-1', 'still writing this')
  expect(useComposerStore.getState().drafts['new:project-1']).toBe('still writing this')
  expect(useComposerStore.getState().drafts['session-1']).toBeUndefined()
  useComposerStore.getState().setDraft('new:project-1', '')
})

test('a draft becoming a Session moves every unsent-Turn fact together', () => {
  const composer = useComposerStore.getState()
  composer.setDraft('new:project-1', 'still writing this')
  composer.addAttachments('new:project-1', ['/repo/notes.md'])
  composer.addTicket('new:project-1', { provider: 'github', key: '2283', title: 'Composer' })
  composer.addPendingTurn('new:project-1', {
    id: crypto.randomUUID(),
    text: 'then send this',
    attachments: [],
  })
  composer.chooseSetup('new:project-1', { model: 'opus', effort: 'high', mode: 'default' })
  composer.beginMarker('new:project-1', {
    stage: 'starting',
    since: null,
    prompt: 'still writing this',
    images: [],
    files: [],
    startedAt: 0,
  })

  composer.rekey('new:project-1', 'session-1')

  const state = useComposerStore.getState()
  expect(state.drafts['new:project-1']).toBeUndefined()
  expect(state.attachments['new:project-1']).toBeUndefined()
  expect(state.tickets['new:project-1']).toBeUndefined()
  expect(state.pendingTurns['new:project-1']).toBeUndefined()
  expect(state.markers['new:project-1']).toBeUndefined()
  expect(state.setup['new:project-1']).toBeUndefined()
  expect(state.drafts['session-1']).toBe('still writing this')
  expect(state.attachments['session-1']).toHaveLength(1)
  expect(state.tickets['session-1']).toHaveLength(1)
  expect(state.pendingTurns['session-1']).toHaveLength(1)
  expect(state.markers['session-1']?.stage).toBe('starting')
  expect(state.setup['session-1']).toEqual({ model: 'opus', effort: 'high', mode: 'default' })
})
