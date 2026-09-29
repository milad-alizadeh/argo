import type { LiveActivity } from '@/domains/sessions/api/feed/feed-rows'

// The activity each observed Feed last published, so the roster draws the same line the Feed does.
export class SessionActivities {
  readonly #activities = new Map<string, LiveActivity>()
  readonly #changed: () => void

  constructor(changed: () => void) {
    this.#changed = changed
  }

  publish(sessionId: string, activity: LiveActivity | null): void {
    const previous = this.#activities.get(sessionId) ?? null
    if (JSON.stringify(previous) === JSON.stringify(activity)) return
    if (activity === null) this.#activities.delete(sessionId)
    else this.#activities.set(sessionId, activity)
    this.#changed()
  }

  activityOf(sessionId: string): LiveActivity | null {
    return this.#activities.get(sessionId) ?? null
  }
}
