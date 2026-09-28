import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import type { Harness } from '@/harnesses/harness'
import type { HistoryChange } from '@/harnesses/registration'
import type { SessionEventJournal } from './session-event-journal'

export type TailHistory = (
  harness: Harness,
  target: SessionHistoryTarget,
  changed: (change: HistoryChange) => void,
) => () => void

type Follower = { invalidators: Set<() => void>; stop: () => void }
export type FollowedHistory = { sessionId: string; harness: Harness; target: SessionHistoryTarget }

// One tail per followed history file, however many readers follow it. A root Session's appended
// events join its journal like a live Session's; a Subagent's history is only ever read whole.
export class SessionHistoryFollowers {
  private readonly followers = new Map<string, Follower>()
  private readonly journal: SessionEventJournal
  private readonly tail: TailHistory
  private readonly hasLiveChannel: (sessionId: string) => boolean

  constructor(
    journal: SessionEventJournal,
    tail: TailHistory,
    hasLiveChannel: (sessionId: string) => boolean,
  ) {
    this.journal = journal
    this.tail = tail
    this.hasLiveChannel = hasLiveChannel
  }

  follow(followed: FollowedHistory, invalidate: () => void): () => void {
    const key = `${followed.sessionId}\u0000${followed.target.subagentId ?? ''}`
    const follower = this.followers.get(key) ?? this.start(key, followed)
    follower.invalidators.add(invalidate)
    return () => {
      follower.invalidators.delete(invalidate)
      if (follower.invalidators.size > 0 || this.followers.get(key) !== follower) return
      this.followers.delete(key)
      follower.stop()
    }
  }

  private start(key: string, { sessionId, harness, target }: FollowedHistory): Follower {
    const invalidators = new Set<() => void>()
    const invalidate = () => {
      for (const listener of invalidators) listener()
    }
    const stop = this.tail(harness, target, (change) => {
      switch (change.type) {
        case 'rewritten':
          invalidate()
          return
        case 'appended':
          if (target.subagentId !== null) invalidate()
          // A live channel already carries these events; the file only catches up with it.
          else if (!this.hasLiveChannel(sessionId))
            for (const event of change.events) this.journal.append(sessionId, event)
          return
      }
    })
    const follower = { invalidators, stop }
    this.followers.set(key, follower)
    return follower
  }
}
