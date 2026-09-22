import { expect, test } from 'bun:test'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import { awaitingAssistantReply } from './use-settled-feed'

const prompt = (id: string): SessionFeedRow => ({
  shape: 'prose',
  id,
  role: 'user',
  text: 'Inspect the Session.',
})

test('a later remote prompt enters context loading again after the first reply', () => {
  const firstPrompt = [prompt('prompt-one')]
  const firstReply = [
    ...firstPrompt,
    { shape: 'prose', id: 'reply-one', role: 'assistant', text: 'Ready.' } as const,
  ]
  const secondPrompt = [...firstReply, prompt('prompt-two')]

  expect(awaitingAssistantReply(firstPrompt)).toBe(true)
  expect(awaitingAssistantReply(firstReply)).toBe(false)
  expect(awaitingAssistantReply(secondPrompt)).toBe(true)
})
