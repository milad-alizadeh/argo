// A Harness's external Session capability with no vendor behind it, for the roster's poll tests:
// a test opens and closes Sessions and decides what each activity read answers.
import type { LiveActivity } from '@/domains/sessions/api/feed'
import type {
  ExternalActivityReading,
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'

export function mockActivity(label: string): LiveActivity {
  return { label, kind: 'command', open: true }
}

// `readsActivity: false` gives a Harness that lists status only.
export function mockExternalSessions({ readsActivity = true }: { readsActivity?: boolean } = {}) {
  const live = new Map<string, LiveExternalSession>()
  const reads: string[] = []
  const answers = new Map<string, ExternalActivityReading>()
  let rejected = 0
  // By default a read answers what `answer` last set for the Session, or nothing new.
  let respond = async (nativeId: string): Promise<ExternalActivityReading> =>
    answers.get(nativeId) ?? { activity: null, status: null }
  const readActivity = (nativeId: string) => {
    reads.push(nativeId)
    return respond(nativeId)
  }
  const external: ExternalSessions = {
    listLive: async () => ({ sessions: [...live.values()], rejected }),
    ...(readsActivity ? { readActivity } : {}),
  }
  return {
    external,
    reads,
    open(nativeId: string, status: ExternalSessionStatus, transcript: string | null) {
      live.set(nativeId, { nativeId, status, transcript })
    },
    close(nativeId: string) {
      live.delete(nativeId)
    },
    reject(count: number) {
      rejected = count
    },
    // What the next reads for this Session answer.
    answer(nativeId: string, reading: Partial<ExternalActivityReading>) {
      answers.set(nativeId, { activity: null, status: null, ...reading })
    },
    // Replaces how reads answer, such as with one a test settles by hand.
    respondWith(next: (nativeId: string) => Promise<ExternalActivityReading>) {
      respond = next
    },
  }
}
