import type { CodexChannel } from '../../../src/agents/codex/drive/codex-channel.ts'
import type { RequestParams } from '../../../src/agents/codex/drive/protocol.ts'

// An in-memory `CodexChannel`, shared by the driver's unit tests: it answers just enough of the
// verbs `codex-session-driver.ts` sends to stand a managed Session up.
export function mockChannel(): CodexChannel & {
  calls: Array<{ method: string; params: unknown }>
  notifications: Array<(message: never) => void>
} {
  const calls: Array<{ method: string; params: unknown }> = []
  const notifications: Array<(message: never) => void> = []
  let turns = 0
  return {
    calls,
    notifications,
    notify: () => {},
    async request<Method extends keyof RequestParams, Result>(
      method: Method,
      params: RequestParams[Method],
      decode: (value: unknown) => Result,
    ) {
      calls.push({ method, params })
      if (method === 'thread/start') return decode({ thread: { id: 'thread-1' } })
      if (method === 'turn/start') {
        turns += 1
        return decode({ turn: { id: `turn-${turns}`, status: 'inProgress' } })
      }
      return decode({})
    },
    onNotification: (listener) => notifications.push(listener as never),
    onExit: () => {},
    respond: () => {},
    close: () => {},
  }
}

export function mockChannelFailing(failing: keyof RequestParams): CodexChannel {
  const channel = mockChannel()
  return {
    ...channel,
    request(method, params, decode) {
      if (method === failing) return Promise.reject(new Error('boom'))
      return channel.request(method, params, decode)
    },
  }
}
