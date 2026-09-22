import { randomUUID } from 'node:crypto'
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

export type StreamInputChannel = {
  iterable: AsyncIterable<SDKUserMessage>
  push: (message: SDKUserMessage) => void
  close: () => void
}

export function userMessage(prompt: string): SDKUserMessage {
  return {
    type: 'user',
    message: { role: 'user', content: prompt },
    parent_tool_use_id: null,
    uuid: randomUUID(),
  }
}

// The SDK's streaming-input mode wants an AsyncIterable it can pull from at its own pace, so
// pushed messages queue until the SDK asks for the next one.
export function createStreamInputChannel(): StreamInputChannel {
  const queue: SDKUserMessage[] = []
  const waiters: Array<(result: IteratorResult<SDKUserMessage>) => void> = []
  let closed = false

  return {
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<SDKUserMessage>> {
            const queued = queue.shift()
            if (queued !== undefined) return Promise.resolve({ value: queued, done: false })
            if (closed) return Promise.resolve({ value: undefined, done: true })
            return new Promise((resolve) => waiters.push(resolve))
          },
        }
      },
    },
    push: (message) => {
      const waiter = waiters.shift()
      if (waiter !== undefined) waiter({ value: message, done: false })
      else queue.push(message)
    },
    close: () => {
      closed = true
      for (const waiter of waiters.splice(0)) waiter({ value: undefined, done: true })
    },
  }
}
