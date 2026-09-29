import { z } from 'zod'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { Question, QuestionAnswer } from '@/domains/sessions/api/questions'
import type { SessionDiscovery } from '@/domains/sessions/api/session-discovery'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import {
  type SessionLiveEventBody,
  sessionLiveEventBodySchema,
} from '@/domains/sessions/api/session-live-event'
import type {
  SessionLiveInput,
  SessionStartInput,
} from '@/domains/sessions/main/api/session-submit'
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
])

// Where a Harness writes Session history, and how it reads the lines it appends.
export type HistoryFiles = {
  directory: string
  // The Session or Subagent id a history file belongs to, or null for a file that holds none.
  ownerOf: (relativePath: string) => string | null
  // A reader for the lines appended after `existing`, the newest complete lines already in the file.
  openReader: (existing: readonly string[]) => (lines: readonly string[]) => HistoryChange
  // Whether a history line opens a turn, closes one, or says nothing about turns.
  turnOf: (line: string) => HistoryTurnMarker | null
}

export type HistoryTurn = 'open' | 'closed'
// The turn a marker names, where the Harness writes one; a close for another turn is stale.
export type HistoryTurnMarker = { turn: HistoryTurn; turnId: string | null }

export type HistoryChange =
  | { type: 'appended'; events: SessionLiveEventBody[] }
  | { type: 'rewritten' }

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
  historyFiles?: HistoryFiles
  openLiveSession?: (
    input: SessionLiveInput,
    controls: LiveSessionControls | undefined,
    emit: (event: LiveSessionChannelEvent) => void,
  ) => LiveSessionChannel
  rename?: (nativeId: string, title: string) => Promise<void>
  sessionDiscovery: SessionDiscovery
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
