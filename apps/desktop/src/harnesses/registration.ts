import { z } from 'zod'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import {
  type ComposerCommandListing,
  composerCommandSchema,
} from '@/domains/sessions/api/composer-commands'
import type { LiveActivity } from '@/domains/sessions/api/feed-activity'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { Permission, PermissionDecision } from '@/domains/sessions/api/permissions'
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
import type { StatusHookEvent } from './host/status-hooks'

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

// The Session status a Harness's own interface gives an external Session (ADR-0048).
export type ExternalSessionStatus = 'running' | 'permission' | 'asking' | 'idle' | 'unknown'

// One Session open outside Argo now, as its Harness's own listing names it.
export type LiveExternalSession = {
  nativeId: string
  // The status the listing gives; null when only an activity read can tell.
  status: ExternalSessionStatus | null
  // The transcript the host stats each tick; null while the Harness cannot name it yet.
  transcript: string | null
}

// Every live external Session, and how many records had a shape or value the Harness rejected.
type LiveExternalSessionList = { sessions: LiveExternalSession[]; rejected: number }

// What a Harness's own interface says a Session is doing now.
export type ExternalActivityReading = {
  // The newest Turn's Feed content; the host finds the activity line with the Feed's own rules.
  turn: readonly FeedContent[]
  // The status the interface settles; null leaves the stored one.
  status: ExternalSessionStatus | null
  // The interface could not answer yet; the host reads again on the next tick.
  retry: boolean
}

// What one hook event says about a Session.
export type ExternalHookReading = {
  nativeId: string
  // null leaves the status as it is.
  status: ExternalSessionStatus | null
  // null keeps the stored line.
  activity: LiveActivity | null
}

// Hooks Argo installs once in the Harness's user-level config, so they fire for every Session.
// Each posts its payload to Argo's receiver on 127.0.0.1 (#2976).
export type ExternalSessionHooks = {
  // Merges Argo's entries naming `port` into the config, keeping every other entry where it is;
  // changes nothing when they are there. Throws, writing nothing, when it cannot read the config.
  install: (port: number) => Promise<void>
  // Deletes exactly the entries Argo wrote.
  remove: () => Promise<void>
  // The port the installed entries name, or null when none are installed.
  installedPort: () => Promise<number | null>
  // One posted payload, or null for a shape the Harness does not document.
  read: (event: StatusHookEvent, payload: unknown) => ExternalHookReading | null
}

// How the external Session poll reads Sessions this Harness runs outside Argo. The host owns the loop,
// the transcript stat, the diff and every write, and skips a Session with a live Argo channel.
// Argo parses no transcript content: the host only stats the path (ADR-0047).
export type ExternalSessions = {
  // Called every poll tick, one call at a time. Reads only a vendor listing or small records, such
  // as a lock probe. Throws when its source cannot answer; the rows then keep what they show.
  listLive: () => Promise<LiveExternalSessionList>
  // Called after a Session's transcript changed or after it left the list, never at start.
  // Answers from a vendor interface, not the transcript; calls run one at a time across every
  // Harness. `changedAt` is when the host last saw the transcript change. Absent means the
  // listing's status alone, with no activity line.
  readActivity?: (nativeId: string, changedAt: number) => Promise<ExternalActivityReading>
  // Once its hooks fire, they replace this Harness's poll.
  hooks?: ExternalSessionHooks
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
    decisions?: Permission['decisions']
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
