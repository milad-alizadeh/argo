import type { SessionLiveInput } from '@/domains/sessions/main/api/session-submit'
import type { CodexAppServerClient } from '@/harnesses/codex/app-server/codex-app-server-client'
import { openCodexSessionChannel } from '@/harnesses/codex/session/codex-session-channel'
import type { LiveSessionChannelEvent } from '@/harnesses/registration'
import { mockStartInput } from './mock-codex-channel.ts'

type FeedBody = Extract<LiveSessionChannelEvent, { type: 'feed' }>['body']

// Every event a live Session emits wakes the waits, so a wait keeps no clock of its own.
const wakers = new Set<() => void>()

// Settles once `check` holds after an emitted event; the test runner bounds how long it waits.
export function waitFor(check: () => boolean): Promise<void> {
  if (check()) return Promise.resolve()
  return new Promise((resolve) => {
    const wake = () => {
      if (!check()) return
      wakers.delete(wake)
      resolve()
    }
    wakers.add(wake)
  })
}

// A live Session channel over a real app-server client, with every event it emits recorded.
export function openLiveSession(
  client: CodexAppServerClient,
  input: SessionLiveInput = mockStartInput,
) {
  const events: LiveSessionChannelEvent[] = []
  const channel = openCodexSessionChannel(input, client, {
    emit: (event) => {
      events.push(event)
      for (const wake of wakers) wake()
    },
  })
  const feed = () =>
    events.flatMap((event): FeedBody[] => (event.type === 'feed' ? [event.body] : []))
  return {
    channel,
    events,
    feed,
    nativeId: () => {
      const identity = events.find((event) => event.type === 'identity')
      return identity?.type === 'identity' ? identity.nativeId : undefined
    },
    statuses: () => feed().flatMap((body) => (body.type === 'status' ? [body.status] : [])),
    assistantText: () =>
      feed().flatMap((body) =>
        body.type === 'content' &&
        body.content.kind === 'message' &&
        body.content.role === 'assistant'
          ? [body.content.text]
          : [],
      ),
    has: (type: LiveSessionChannelEvent['type']) => events.some((event) => event.type === type),
  }
}
