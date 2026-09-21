import { expect, test } from 'bun:test'
import { performSend } from '@/domains/sessions/renderer/composer/use-send'

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
      addPendingTurn: (text: string, setup: unknown, attachments: unknown) => {
        calls.addPendingTurn.push({ text, setup, attachments })
      },
      editor: null,
      onSend: async (text: string, setup: unknown, attachments: unknown) => {
        calls.onSend.push({ text, setup, attachments })
        return true
      },
      setupValue: null,
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
  expect(calls.addPendingTurn).toEqual([{ text: 'hello', setup: undefined, attachments: [] }])
  expect(calls.onSend).toEqual([])
})

test('a Send with no Turn running calls onSend and never queues', async () => {
  const { calls, input } = fixture({ isRunning: false })
  await performSend(input)
  expect(calls.onSend).toEqual([{ text: 'hello', setup: null, attachments: [] }])
  expect(calls.addPendingTurn).toEqual([])
})

test('an empty draft with no attachments does neither', async () => {
  const { calls, input } = fixture({ draft: '   ', isRunning: false })
  await performSend(input)
  expect(calls.onSend).toEqual([])
  expect(calls.addPendingTurn).toEqual([])
})
