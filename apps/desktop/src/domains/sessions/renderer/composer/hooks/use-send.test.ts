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
      onSend: async (text: string, turnConfiguration: unknown, attachments: unknown) => {
        calls.onSend.push({ text, turnConfiguration, attachments })
        return true
      },
      turnConfigurationValue: null,
      clearSentContent: (ids: string[]) => {
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

test('a rejected Send leaves its draft in place', async () => {
  const { calls, input } = fixture({
    onSend: async () => false,
  })

  await performSend(input)

  expect(calls.cleared).toEqual([])
})

test('an accepted Send leaves a newer attachment edit intact', async () => {
  const start = composerEditing({ prompt: 'hello' })
  let latest = start
  const { input } = fixture({
    isCurrentDraft: () => sameDraftContent(start, latest),
    onSend: async () => {
      latest = editComposer(latest, {
        type: 'attachments.added',
        paths: ['/new'],
        createId: () => 'new',
      })
      return 'accepted'
    },
    clearSentContent: (sentIds) => {
      latest = editComposer(latest, { type: 'send.accepted', sentIds })
    },
  })

  await performSend(input)

  expect(latest.prompt).toBe('hello')
  expect(latest.attachments).toEqual([{ id: 'new', path: '/new' }])
})

test('a rejected Send does not clear a newer edit', async () => {
  let current = true
  const { calls, input } = fixture({
    isCurrentDraft: () => current,
    onSend: async () => {
      current = false
      return 'rejected'
    },
  })

  await performSend(input)

  expect(calls.cleared).toEqual([])
})

test('an uncertain Send keeps its draft and does not clear attachments', async () => {
  const { calls, input } = fixture({
    onSend: async () => 'uncertain',
  })

  await performSend(input)

  expect(calls.cleared).toEqual([])
})

test('an accepted Send clears sent content after an attachment status error', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      argo: {
        trpc: async (request: { id: number; path: string }) => {
          if (request.path !== 'sessionAttachmentStat') throw new Error(request.path)
          return {
            id: request.id,
            result: {
              data: {
                files: [
                  { path: '/readable', readable: true },
                  { path: '/missing', readable: false },
                ],
              },
            },
          }
        },
      },
    },
  })
  const start = composerEditing({
    prompt: 'hello',
    attachments: [
      { id: 'readable', path: '/readable' },
      { id: 'missing', path: '/missing' },
    ],
  })
  let latest = start
  let failedIds: string[] = []
  let sentAttachments: unknown[] = []
  try {
    const { calls, input } = fixture({
      attachments: start.attachments,
      markError: (ids) => {
        failedIds = ids
      },
      isCurrentDraft: () => sameDraftContent(start, latest),
      onSend: async (_prompt, _configuration, attachments) => {
        sentAttachments = attachments
        return 'accepted'
      },
      clearSentContent: (sentIds) => {
        calls.cleared.push(sentIds)
        latest = editComposer(latest, { type: 'send.accepted', sentIds })
      },
    })

    await performSend(input)

    expect(latest.prompt).toBe('')
    expect(calls.cleared).toEqual([['readable']])
    expect(sentAttachments).toEqual([{ path: '/readable', kind: 'file' }])
    expect(latest.attachments).toEqual([{ id: 'missing', path: '/missing' }])
    expect(failedIds).toEqual(['missing'])
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('an empty draft with no attachments does neither', async () => {
  const { calls, input } = fixture({ draft: '   ' })
  await performSend(input)
  expect(calls.onSend).toEqual([])
})
