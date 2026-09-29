import assert from 'node:assert/strict'
import type { SessionStartInput } from '@/domains/sessions/main/api/session-submit'
import type {
  CodexRequest,
  WireMessage,
} from '@/harnesses/codex/app-server/codex-app-server-client'
import { openCodexSessionChannel } from '@/harnesses/codex/session/codex-session-channel'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'

// A Codex channel over a mock app-server client; `notify` delivers what the app-server would.
export const mockStartInput: SessionStartInput = {
  commandId: '00000000-0000-4000-8000-000000000001',
  harness: 'codex',
  projectId: '00000000-0000-4000-8000-000000000099',
  workspaceId: '00000000-0000-4000-8000-000000000098',
  cwd: '/repo',
  prompt: 'first',
  attachments: [],
  turnConfiguration: { model: 'model', effort: 'medium', mode: 'workspace-write' },
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
      request,
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
