import { z } from 'zod'
import { liveActivitySchema } from '@/domains/sessions/contract/feed-rows'
import { createSessionRosterRowSchema } from '@/domains/sessions/contract/roster-row-definition'
import { ticketKey } from '@/domains/tickets/contract/ticket'
import { identifierSchema } from '@/shared/validation'

export {
  FEED_EVENT_KINDS,
  FEED_MARKERS,
  type FeedEventKind,
  type FeedMarker,
  feedEventKindSchema,
  feedMarkerSchema,
  type SessionFeedRow,
  sessionFeedRowSchema,
  UNREADABLE_ROW,
  unreadableRowHeight,
} from '@/domains/sessions/contract/feed-rows'

export const SESSION_POSTURES = ['managed', 'external'] as const
export const sessionPostureSchema = z.enum(SESSION_POSTURES)
export const SESSION_ENTRIES = ['interactive', 'headless'] as const
export const sessionEntrySchema = z.enum(SESSION_ENTRIES)
export const SESSION_STATUSES = [
  'starting',
  'running',
  'permission',
  'asking',
  'idle',
  'stopped',
  'ended',
  'unknown',
] as const
export const sessionStatusSchema = z.enum(SESSION_STATUSES)
// Strongest first: `managed-row.ts` ranks two titles by this order, so reordering it changes which
// title a managed Session shows.
export const TITLE_SOURCES = ['custom', 'summarised', 'first-prompt'] as const
export const titleSourceSchema = z.enum(TITLE_SOURCES)

export type SessionPosture = z.infer<typeof sessionPostureSchema>
export type SessionEntry = z.infer<typeof sessionEntrySchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>
export const sessionTitleSchema = z.strictObject({ text: z.string(), source: titleSourceSchema })
export type SessionTitle = z.infer<typeof sessionTitleSchema>

// CONTEXT.md L3 · Subagent, as the parent Session's transcript shows it: the Tool Call that spawned
// it, with the label that call gave it, absent rather than invented where the call carried none.
// `landed` is whether the call's result came back. Whether an unlanded one is still running is a
// question about the parent's own status too, which is why that fold is `delegation.ts`'s.
// `startedAt` is when the call was written and `endedAt` when its result or its completion
// notification landed, so the two together are how long the Subagent ran.
export const sessionDelegationSchema = z.strictObject({
  id: identifierSchema,
  label: z.string().nullable(),
  landed: z.boolean(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
})
export type SessionDelegation = z.infer<typeof sessionDelegationSchema>

const countSchema = z.number().int().nonnegative()
export const PLAN_ENTRY_STATUSES = ['pending', 'in_progress', 'completed'] as const
export const planEntryStatusSchema = z.enum(PLAN_ENTRY_STATUSES)
export type PlanEntryStatus = z.infer<typeof planEntryStatusSchema>

// CONTEXT.md L3 · Plan: newest snapshot verbatim, plus its display position; malformed is never partial.
export const sessionPlanEntrySchema = z.strictObject({
  content: z.string().trim().min(1),
  position: countSchema,
  status: planEntryStatusSchema,
})
export type SessionPlanEntry = z.infer<typeof sessionPlanEntrySchema>
export const sessionPlanSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('available'), entries: z.array(sessionPlanEntrySchema) }),
  z.strictObject({ state: z.literal('malformed') }),
])
export type SessionPlan = z.infer<typeof sessionPlanSchema>

// The newest Tool Call inside the open Turn: its canonical reader-facing label and kind, plus the
// tool's own name and the one thing it acted on as metadata. `open` is the transcript holding no
// answer to it yet, what lets the row read "Running" rather than "Ran" while the Session runs.
export const sessionActivitySchema = liveActivitySchema.extend({
  tool: z.string(),
  target: z.string().nullable(),
})
export type SessionActivity = z.infer<typeof sessionActivitySchema>

// The newest pull request the CLI linked this Session to, as its own `pr-link` record states it.
// Its state (open, merged, closed, draft) is the code host's fact (CONTEXT.md L4 · Delivery), and
// no transcript holds it.
export const sessionPullRequestSchema = z.strictObject({
  number: countSchema,
  url: z.string(),
  repository: z.string().nullable(),
})
export type SessionPullRequest = z.infer<typeof sessionPullRequestSchema>

// The Ticket a reader asserted this Session works on (CONTEXT.md L1 · Session → Ticket), the
// fallback link ADR-0017 persists for a Session with no branch to derive one through. `title` and
// `state` are the cached echo from the moment a reader connected it, never authoritative: a screen
// that needs the current fact re-reads the Ticket through its Project's Connection.
export const sessionTicketSchema = z.strictObject({
  projectId: identifierSchema,
  key: ticketKey,
  title: z.string(),
  state: z.enum(['open', 'closed']),
  createdAt: z.iso.datetime(),
})
export type SessionTicket = z.infer<typeof sessionTicketSchema>

// How a Shell command stands. A foreground command is `running` until its result lands, and is
// then not read at all. A background one keeps its final state, because that result is what
// replaces the running row the reader was watching (#1582).
export const SHELL_STATES = ['running', 'completed', 'failed', 'interrupted'] as const
export const shellStateSchema = z.enum(SHELL_STATES)
export type ShellState = z.infer<typeof shellStateSchema>

// A shell command the Session ran: the first line of what it was asked to run, whether it was
// sent to the background, and where it stands. `command` is absent where the call carries none.
// A background command also names the file the CLI streams its output to, and the sentence the
// notification ended it with.
export const sessionShellCommandSchema = z.strictObject({
  id: identifierSchema,
  command: z.string().nullable(),
  label: z.string().nullable(),
  background: z.boolean(),
  state: shellStateSchema,
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  outputPath: z.string().nullable(),
  result: z.string().nullable(),
})
export type SessionShellCommand = z.infer<typeof sessionShellCommandSchema>

// The newest Turn's Model, Effort and Mode, verbatim; null where no record states it yet.
export const sessionSetupSchema = z.strictObject({
  model: z.string().nullable(),
  effort: z.string().nullable(),
  mode: z.string().nullable(),
})
export type SessionSetup = z.infer<typeof sessionSetupSchema>

export const sessionRosterRowSchema = createSessionRosterRowSchema()
export type SessionRosterRow = z.infer<typeof sessionRosterRowSchema>

export function currentSessionId<Session extends Pick<SessionRosterRow, 'id' | 'retiredIds'>>(
  sessions: Session[],
  rememberedId: string,
): string | null {
  return (
    sessions.find(
      (session) => session.id === rememberedId || session.retiredIds.includes(rememberedId),
    )?.id ?? null
  )
}

// The Roster's own order (#1593, #2239): newest-first by `updatedAt`, shared by every read that
// re-sorts a set of rows rather than trusting an already-ordered source.
export function newestFirst(
  left: Pick<SessionRosterRow, 'updatedAt'>,
  right: Pick<SessionRosterRow, 'updatedAt'>,
): number {
  return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
}
