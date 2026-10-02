import assert from 'node:assert/strict'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import type {
  CodexRequest,
  WireMessage,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import { openCodexSessionChannel } from '@/harnesses/codex/session/codex-session-channel'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'

const MOCK_SESSION_ID = '00000000-0000-4000-8000-000000000097'

// A Codex channel over a mock app-server client; `notify` delivers what the app-server would.
export const mockStartInput: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'codex',
  projectId: '00000000-0000-4000-8000-000000000099',
  worktree: null,
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
}

// Every live Session lists its skills; a stub app-server that knows no other skill lists none.
export function answeringSkillsList(request: CodexRequest): CodexRequest {
  return ((method, params, parse) =>
    method === 'skills/list'
      ? Promise.resolve(parse({ data: [] }))
      : request(method, params, parse)) as CodexRequest
}

export function mockCodexChannel(
  request: CodexRequest,
  responses: Array<{ id: string | number; result: unknown }> = [],
) {
  const events: LiveSessionChannelEvent[] = []
  let listener: ((message: WireMessage) => boolean | undefined) | undefined
  const channel = openCodexSessionChannel(
    mockStartInput,
    {
      request: answeringSkillsList(request),
      onNotification(notify) {
        listener = notify
        return () => {
          listener = undefined
        }
      },
      respond: (id, result) => responses.push({ id, result }),
    },
    { emit: events.push.bind(events) },
  )
  return {
    channel,
    events,
    notify(message: WireMessage) {
      assert.ok(listener)
      return listener(message)
    },
    subscribed: () => listener !== undefined,
  }
}

// A channel over an app-server that starts `thread-1` and answers every Turn with `turn-1`.
export async function openOneTurnCodexChannel() {
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) =>
    parse(
      method === 'thread/start' ? { thread: { id: 'thread-1' } } : { turn: { id: 'turn-1' } },
    )) as CodexRequest
  const opened = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  return opened
}

// The channel's Feed bodies as the live events a Session records, numbered in emit order.
export function mockLiveEvents(events: readonly LiveSessionChannelEvent[]): SessionLiveEvent[] {
  return events.flatMap((event, index): SessionLiveEvent[] =>
    event.type === 'feed'
      ? [
          {
            ...event.body,
            sessionId: MOCK_SESSION_ID,
            sequence: index + 1,
          } as SessionLiveEvent,
        ]
      : [],
  )
}
