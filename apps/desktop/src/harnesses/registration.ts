import { z } from 'zod'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import {
  type ComposerCommandListing,
  composerCommandSchema,
} from '@/domains/sessions/api/composer-commands'
import type { LiveActivity } from '@/domains/sessions/api/feed'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { Question, QuestionAnswer } from '@/domains/sessions/api/questions'
import type {
  SessionSummaryList,
  SessionSummaryReader,
} from '@/domains/sessions/api/session-discovery'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import { sessionLiveEventBodySchema } from '@/domains/sessions/api/session-live-event'
import type { SessionLiveInput, SessionStartInput } from '@/domains/sessions/main/api'
import type { HarnessInfo } from '@/harnesses/harness-catalog'
import { identifierSchema } from '@/shared/validation'
import type { Harness } from './harness'

export const liveSessionChannelEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('identity'), nativeId: identifierSchema }),
  z.strictObject({ type: z.literal('command.accepted'), commandId: identifierSchema }),
  z.strictObject({ type: z.literal('turn.started'), commandId: identifierSchema }),
  z.strictObject({ type: z.literal('turn.completed'), commandId: identifierSchema }),
  z.strictObject({ type: z.literal('feed'), body: sessionLiveEventBodySchema }),
  z.strictObject({ type: z.literal('failure'), detail: z.string().min(1) }),
  z.strictObject({ type: z.literal('closed') }),
  z.strictObject({
    type: z.literal('commands'),
    availability: z.enum(['listed', 'unavailable']),
    commands: z.array(composerCommandSchema),
  }),
])

// The roster status a Harness's own records give an external Session (ADR-0048).
export type ExternalSessionStatus = 'running' | 'permission' | 'asking' | 'idle' | 'unknown'

// One Session open outside Argo now, as its Harness's own records name it.
export type LiveExternalSession = {
  nativeId: string
  // `unknown` for a value the Harness does not recognise, or when only the transcript can tell.
  status: ExternalSessionStatus
  // The transcript the host tails while the Session is live; null when the Harness has none.
  transcript: string | null
}

// Every live external Session, and how many records had a shape or value the Harness rejected.
type LiveExternalSessionList = { sessions: LiveExternalSession[]; rejected: number }

// Complete lines a transcript gained. `continued` is false when they do not follow the last lines
// handed over: the file was truncated or rewritten, or grew past the tail's window.
export type TranscriptLines = { lines: readonly string[]; continued: boolean }

// What a transcript's new lines say about its Session.
export type TranscriptReading = {
  // The newest activity in the lines; null keeps the line the row already shows.
  activity: LiveActivity | null
  // A status the lines settle, such as a turn start or end marker; null leaves the listed status.
  status: ExternalSessionStatus | null
}

// How the roster's poll reads Sessions this Harness runs outside Argo. The host owns the loop,
// the stat, the tail, the diff and every write, and skips a Session with a live Argo channel.
export type ExternalSessions = {
  // Called every poll tick. Reads only small records such as pid files and lock probes.
  listLive: () => Promise<LiveExternalSessionList>
  // Called with the lines a live Session's transcript gained since the last call, never at start.
  readTranscript: (nativeId: string, lines: TranscriptLines) => Promise<TranscriptReading>
}

export type LiveSessionChannelEvent = z.infer<typeof liveSessionChannelEventSchema>
export type LiveSessionCommand = Pick<
  SessionStartInput,
  'commandId' | 'prompt' | 'attachments' | 'turnConfiguration'
>
export type LiveSessionChannel = {
  submit: (command: LiveSessionCommand) => Promise<void>
  interrupt: () => Promise<void>
  answerPermission: (requestId: string, decision: PermissionDecision) => Promise<boolean>
  answerQuestion: (requestId: string, answers: QuestionAnswer[]) => Promise<boolean>
  close: () => void
}
export type LiveSessionControls = {
  requestPermission: (request: {
    nativeId: string
    requestId: string
    description: string
    signal: AbortSignal
  }) => Promise<PermissionDecision>
  requestQuestion: (request: {
    nativeId: string
    requestId: string
    questions: Question[]
    signal: AbortSignal
  }) => Promise<QuestionAnswer[]>
  decidePermission: (nativeId: string, requestId: string, decision: PermissionDecision) => boolean
  decideQuestion: (nativeId: string, requestId: string, answers: QuestionAnswer[]) => boolean
}

export type HarnessRegistration<Id extends Harness = Harness> = HarnessReadinessRegistration & {
  harness: Id
  readCatalog: () => Promise<HarnessInfo>
  readHistory: (target: SessionHistoryTarget) => Promise<FeedContent[]>
  hasTurn?: (nativeId: string, turnId: string) => Promise<boolean>
  // Absent for a Harness that runs only Sessions Argo starts.
  externalSessions?: ExternalSessions
  openLiveSession?: (
    input: SessionLiveInput,
    controls: LiveSessionControls | undefined,
    emit: (event: LiveSessionChannelEvent) => void,
  ) => LiveSessionChannel
  // Commands a draft can show before a live Session exists. A Harness without this stays pending.
  listCommands?: (input: { cwd: string | null }) => Promise<ComposerCommandListing>
  rename?: (nativeId: string, title: string) => Promise<void>
  listSessionSummaries: SessionSummaryList
  getSessionSummary: SessionSummaryReader
  // A later Send may change only these Turn settings; any setting left out stays fixed.
  changeableTurnSettings: readonly ('model' | 'effort' | 'mode')[]
  acceptsAttachments: boolean
  // The token count at which the Harness compacts a Session's context on its own.
  autoCompactLimit?: {
    read: () => Promise<number>
    write: (limit: number) => Promise<number>
  }
  shutdown?: () => void
}
