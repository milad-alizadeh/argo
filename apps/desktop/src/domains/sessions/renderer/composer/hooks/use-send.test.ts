import { expect, test } from 'bun:test'
import { performSend } from './use-send'

function fixture(overrides: Partial<Parameters<typeof performSend>[0]> = {}) {
  const calls = {
    addPendingTurn: [] as unknown[],
    onSend: [] as unknown[],
    cleared: [] as unknown[],
  }
  return {
    calls,
    input: {
      draft: 'hello',
      attachments: [],
      markError: () => {},
      isRunning: false,
      addPendingTurn: (text: string, turnConfiguration: unknown, attachments: unknown) => {
        calls.addPendingTurn.push({ text, turnConfiguration, attachments })
      },
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
      ...overrides,
    },
  }
}

// A Turn already running (#2099): the content goes to the queued-Turn list, and onSend — which is
// what begins the Turn Marker — never fires, so a queued Send never shows a Marker of its own.
test('a Send while a Turn is running queues it and never calls onSend', async () => {
  const { calls, input } = fixture({ isRunning: true })
  await performSend(input)
  expect(calls.addPendingTurn).toEqual([
    { text: 'hello', turnConfiguration: undefined, attachments: [] },
  ])
  expect(calls.onSend).toEqual([])
})

test('a Send with no Turn running calls onSend and never queues', async () => {
  const { calls, input } = fixture({ isRunning: false })
  await performSend(input)
  expect(calls.onSend).toEqual([{ text: 'hello', turnConfiguration: null, attachments: [] }])
  expect(calls.addPendingTurn).toEqual([])
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

test('an empty draft with no attachments does neither', async () => {
  const { calls, input } = fixture({ draft: '   ', isRunning: false })
  await performSend(input)
  expect(calls.onSend).toEqual([])
  expect(calls.addPendingTurn).toEqual([])
})
