import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { z } from 'zod'
import type { Database } from '@/database/database'
import {
  type SessionLiveEvent,
  sessionLiveUpdateSchema,
} from '@/domains/sessions/api/session-live-event'
import { identifierSchema } from '@/shared/validation'
import type { SessionEventJournal } from '../live/session-event-journal'
import type { SessionHistoryFollowers } from '../live/session-history-followers'
import { sessionHistoryIdentity } from './session-history-identity'

const t = initTRPC.create()
const inputSchema = z.strictObject({
  sessionId: identifierSchema,
  subagentId: identifierSchema.nullable().optional(),
  cursor: z.number().int().nonnegative(),
  generation: identifierSchema.nullable().optional(),
})

function canDeliver(event: SessionLiveEvent, live: boolean): boolean {
  if (live) return true
  switch (event.type) {
    case 'permission':
      return false
    case 'question':
      return event.answer !== null
    case 'content':
    case 'status':
    case 'failure':
      return true
  }
}

export type SessionLiveEventsContext = {
  database: Database
  journal: SessionEventJournal
  hasLiveChannel: (sessionId: string) => boolean
  followHistory?: SessionHistoryFollowers['follow']
}

type StoredSession = ReturnType<typeof sessionHistoryIdentity>
type LiveUpdate = z.infer<typeof sessionLiveUpdateSchema>

function followHistory(
  context: SessionLiveEventsContext,
  session: { sessionId: string; stored: StoredSession; subagentId: string | null },
  emit: { next: (update: LiveUpdate) => void },
) {
  const { sessionId, stored, subagentId } = session
  return context.followHistory?.(
    {
      sessionId,
      harness: stored.harness,
      target: { nativeId: stored.nativeId, subagentId, cwd: stored.cwd },
    },
    () => emit.next(sessionLiveUpdateSchema.parse({ type: 'invalidated' })),
  )
}

function subagentLiveUpdates(
  context: SessionLiveEventsContext,
  session: { sessionId: string; stored: StoredSession; subagentId: string },
) {
  return observable<LiveUpdate>((emit) => {
    emit.next(
      sessionLiveUpdateSchema.parse({
        type: 'ready',
        live: false,
        cursor: 0,
        generation: context.journal.generation,
        replayExpired: false,
      }),
    )
    const unwatch = followHistory(context, session, emit)
    return () => unwatch?.()
  })
}

type LiveInput = z.infer<typeof inputSchema>
type JournalEvent = ReturnType<SessionEventJournal['append']>

// Sends the ready message and the journal's replay, and returns whether the Session is live.
function sendReplay(
  context: SessionLiveEventsContext,
  input: LiveInput,
  send: {
    update: (update: LiveUpdate) => void
    event: (event: JournalEvent, live: boolean) => void
  },
) {
  const replay = context.journal.replay(input.sessionId, input.cursor, input.generation ?? null)
  const live = context.hasLiveChannel(input.sessionId)
  send.update(
    sessionLiveUpdateSchema.parse({
      type: 'ready',
      live,
      cursor: replay.cursor,
      generation: context.journal.generation,
      replayExpired: replay.type === 'expired',
    }),
  )
  if (replay.type === 'expired') send.update(sessionLiveUpdateSchema.parse(replay))
  else for (const event of replay.events) send.event(event, live)
  return { live, cursor: replay.cursor }
}

export function sessionLiveEventsProcedure(context: SessionLiveEventsContext) {
  return t.procedure.input(inputSchema).subscription(({ input }) => {
    const stored = sessionHistoryIdentity(context.database, input.sessionId)
    const subagentId = input.subagentId ?? null
    if (subagentId !== null)
      return subagentLiveUpdates(context, { sessionId: input.sessionId, stored, subagentId })
    return observable<LiveUpdate>((emit) => {
      let replaying = true
      const pending: JournalEvent[] = []
      const sendEvent = (event: JournalEvent, live: boolean) => {
        if (canDeliver(event, live))
          emit.next(sessionLiveUpdateSchema.parse({ type: 'event', event }))
      }
      const unsubscribe = context.journal.subscribe(input.sessionId, (event) => {
        if (replaying) pending.push(event)
        else sendEvent(event, context.hasLiveChannel(input.sessionId))
      })
      const { live, cursor } = sendReplay(context, input, {
        update: (update) => emit.next(update),
        event: sendEvent,
      })
      while (pending.length > 0) {
        const event = pending.shift()
        if (event !== undefined && event.sequence > cursor)
          sendEvent(event, context.hasLiveChannel(input.sessionId))
      }
      replaying = false
      // A live channel already delivers every event this Session makes.
      const unwatch = live
        ? undefined
        : followHistory(context, { sessionId: input.sessionId, stored, subagentId: null }, emit)
      return () => {
        unsubscribe()
        unwatch?.()
      }
    })
  })
}
