import { expect, test } from 'bun:test'
import type { SessionFeedRow } from '../../types'
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

test('a Turn status row after the prompt still awaits the reply', () => {
  const running = { shape: 'event', id: 'status:2', event: 'liveStatus', text: 'running' } as const
  expect(awaitingAssistantReply([prompt('prompt-one'), running])).toBe(true)
})
