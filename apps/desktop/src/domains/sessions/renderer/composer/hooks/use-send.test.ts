import { expect, test } from 'bun:test'
import { performSend } from './use-send'

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
  const { calls, input } = fixture({ draft: '   ' })
  await performSend(input)
  expect(calls.onSend).toEqual([])
})
