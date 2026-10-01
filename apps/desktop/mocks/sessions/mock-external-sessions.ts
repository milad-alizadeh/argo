// A Harness's external Session capability with no vendor behind it, for the roster's poll tests:
// a test opens and closes Sessions and decides what each transcript read says.
import type { LiveActivity } from '@/domains/sessions/api/feed'
import type {
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
  TranscriptLines,
  TranscriptReading,
} from '@/harnesses/registration'

type TranscriptRead = { nativeId: string; lines: TranscriptLines }

// The activity line a mock reading names for the newest line it was given.
export function mockActivity(label: string): LiveActivity {
  return { label, kind: 'command', open: true }
}

export function mockExternalSessions() {
  const live = new Map<string, LiveExternalSession>()
  const reads: TranscriptRead[] = []
  let rejected = 0
  // Each line `status:<status>` settles that status; any other line names a command.
  let answer = async ({ lines }: TranscriptRead): Promise<TranscriptReading> => {
    const newest = lines.lines.at(-1) ?? null
    const settled = lines.lines.findLast((line) => line.startsWith('status:'))
    return {
      activity: newest === null || newest.startsWith('status:') ? null : mockActivity(newest),
      status:
        settled === undefined ? null : (settled.slice('status:'.length) as ExternalSessionStatus),
    }
  }
  const external: ExternalSessions = {
    listLive: async () => ({ sessions: [...live.values()], rejected }),
    readTranscript: (nativeId, lines) => {
      const read = { nativeId, lines }
      reads.push(read)
      return answer(read)
    },
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
    // Replaces how reads answer, such as with one a test settles by hand.
    answerWith(next: (read: TranscriptRead) => Promise<TranscriptReading>) {
      answer = next
    },
  }
}
