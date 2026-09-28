import { expect, test } from 'bun:test'
import { composerEditing, editComposer } from '../editing/composer-editing'
import { performSend, sameDraftContent } from './use-send'

function fixture(overrides: Partial<Parameters<typeof performSend>[0]> = {}) {
  const calls = {
    onSend: [] as unknown[],
    cleared: [] as unknown[],
  }
  return {
    calls,
    input: {
      draft: 'hello',
      attachments: [],
      markError: () => {},
      editor: null,
      onSend: async (text: string, turnConfiguration: unknown, attachments: unknown) => {
        calls.onSend.push({ text, turnConfiguration, attachments })
        return true
      },
      turnConfigurationValue: null,
      clearDraft: () => {},
      restoreDraft: () => {},
      clear: (ids: string[]) => {
        calls.cleared.push(ids)
      },
      isCurrentDraft: () => true,
      ...overrides,
    },
  }
}

test('a Send while a Turn is running goes through the durable send callback', async () => {
  const { calls, input } = fixture()
  await performSend(input)
  expect(calls.onSend).toEqual([{ text: 'hello', turnConfiguration: null, attachments: [] }])
})

test('a rejected Send restores its draft', async () => {
  const restored: string[] = []
  const { input } = fixture({
    onSend: async () => false,
    restoreDraft: (draft) => restored.push(draft),
  })

  await performSend(input)

  expect(restored).toEqual(['hello'])
})

test('an accepted Send leaves a newer edit intact', async () => {
  let current = true
  let clearCount = 0
  const { input } = fixture({
    isCurrentDraft: () => current,
    onSend: async () => {
      current = false
      return 'accepted'
    },
    clearDraft: () => {
      clearCount += 1
    },
  })

  await performSend(input)

  expect(clearCount).toBe(0)
})

test('a rejected Send does not restore over a newer edit', async () => {
  let current = true
  const restored: string[] = []
  const { input } = fixture({
    isCurrentDraft: () => current,
    onSend: async () => {
      current = false
      return 'rejected'
    },
    restoreDraft: (draft) => restored.push(draft),
  })

  await performSend(input)

  expect(restored).toEqual([])
})

test('an uncertain Send keeps its draft and does not clear attachments', async () => {
  const restored: string[] = []
  const { calls, input } = fixture({
    onSend: async () => 'uncertain',
    restoreDraft: (draft) => restored.push(draft),
  })

  await performSend(input)

  expect(restored).toEqual([])
  expect(calls.cleared).toEqual([])
})

test('an accepted Send clears sent content after an attachment status error', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      argo: {
        statSessionAttachments: async () => ({
          type: 'session.attachments.statted',
          files: [
            { path: '/readable', readable: true },
            { path: '/missing', readable: false },
          ],
        }),
      },
    },
  })
  const start = composerEditing({
    prompt: 'hello',
    attachments: [
      { id: 'readable', path: '/readable', status: 'idle' },
      { id: 'missing', path: '/missing', status: 'idle' },
    ],
  })
  let latest = start
  let cleared = 0
  let sentAttachments: unknown[] = []
  try {
    const { calls, input } = fixture({
      attachments: start.attachments,
      markError: (ids) => {
        latest = editComposer(latest, { type: 'attachments.failed', ids })
      },
      isCurrentDraft: () => sameDraftContent(start, latest),
      onSend: async (_prompt, _configuration, attachments) => {
        sentAttachments = attachments
        return 'accepted'
      },
      clearDraft: () => {
        cleared += 1
      },
    })

    await performSend(input)

    expect(cleared).toBe(1)
    expect(calls.cleared).toEqual([['readable']])
    expect(sentAttachments).toEqual([{ path: '/readable', kind: 'file' }])
    expect(latest.attachments[1]?.status).toBe('error')
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('a newer attachment change is not the same draft content', () => {
  const start = composerEditing({
    attachments: [{ id: 'one', path: '/one', status: 'idle' }],
  })
  const statusUpdate = editComposer(start, { type: 'attachments.failed', ids: ['one'] })
  const userEdit = editComposer(statusUpdate, {
    type: 'attachments.added',
    paths: ['/two'],
    createId: () => 'two',
  })
  expect(sameDraftContent(start, statusUpdate)).toBe(true)
  expect(sameDraftContent(start, userEdit)).toBe(false)
})

test('an empty draft with no attachments does neither', async () => {
  const { calls, input } = fixture({ draft: '   ' })
  await performSend(input)
  expect(calls.onSend).toEqual([])
})
