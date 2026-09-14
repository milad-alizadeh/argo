import { beforeEach, describe, expect, test } from 'bun:test'

import { useComposerStore } from './useComposerStore'

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
})

// A draft is keyed by the composer's identity, so it survives under a draft key even though no
// Session exists yet, and is invisible under any Session id.
test('a draft survives before a Session exists, keyed by its own identity', () => {
  useComposerStore.getState().setDraft('new:project-1', 'still writing this')
  expect(useComposerStore.getState().drafts['new:project-1']).toBe('still writing this')
  expect(useComposerStore.getState().drafts['session-1']).toBeUndefined()
  useComposerStore.getState().setDraft('new:project-1', '')
})
