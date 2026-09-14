import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { ticketKey } from '../tickets/ticket'

export {
  FEED_MARKERS,
  type FeedMarker,
  feedMarkerSchema,
  type SessionFeedRow,
  sessionFeedRowSchema,
  UNREADABLE_ROW,
  unreadableRowHeight,
} from './feed-rows'

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
export const sessionDelegationSchema = z.strictObject({
  id: identifierSchema,
  label: z.string().nullable(),
  landed: z.boolean(),
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

// The newest Tool Call inside the open Turn: the tool's own name, and the one thing it acted on,
// read off its input rather than summarised.
export const sessionActivitySchema = z.strictObject({
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

// A shell command the Session is running now: the first line of what it was asked to run, and
// whether it was sent to the background. `command` is absent where the call carries none.
export const sessionShellCommandSchema = z.strictObject({
  id: identifierSchema,
  command: z.string().nullable(),
  background: z.boolean(),
})
export type SessionShellCommand = z.infer<typeof sessionShellCommandSchema>

// The newest Turn's Model, Effort and Mode, verbatim; null where no record states it yet.
export const sessionSetupSchema = z.strictObject({
  model: z.string().nullable(),
  effort: z.string().nullable(),
  mode: z.string().nullable(),
})
export type SessionSetup = z.infer<typeof sessionSetupSchema>

export const sessionRosterRowSchema = z.strictObject({
  id: identifierSchema,
  retiredIds: z.array(identifierSchema),
  cli: identifierSchema,
  posture: sessionPostureSchema,
  title: sessionTitleSchema.nullable(),
  status: sessionStatusSchema,
  entry: sessionEntrySchema,
  cwd: z.string().nullable(),
  branch: z.string().nullable(),
  // Another live Argo window on this machine holds this Session's channel now, so Send is refused
  // and the Roster marks it read-only (ADR-0040, CONTEXT.md L2 · Session). Absent where no source
  // reports live-channel ownership, which reads the same as `false`.
  locked: z.boolean().optional(),
  updatedAt: z.string().nullable(),
  unreadableLines: z.number(),
  originUnread: z.boolean(),
  // When the prompt that opened the newest Turn was written (CONTEXT.md L3 · Turn).
  turnStartedAt: z.string().nullable(),
  activity: sessionActivitySchema.nullable(),
  plan: sessionPlanSchema.nullable(),
  delegations: z.array(sessionDelegationSchema),
  // The shell commands running now, read off `Bash` calls with no result (`sessions/signals.ts`).
  shell: z.array(sessionShellCommandSchema),
  pullRequest: sessionPullRequestSchema.nullable(),
  ticket: sessionTicketSchema.nullable(),
  // Whether the reader has archived this Session. Argo keeps no flag of its own: this is the
  // Claude desktop app's own `isArchived`, joined on the CLI Session id (`sessions/archive.ts`).
  archived: z.boolean(),
  contextTokens: countSchema.nullable().optional(),
  spentTokens: countSchema.nullable().optional(),
  // A managed Claude Session is compacting only after Argo typed its `/compact` command. The
  // transcript's compact boundary clears this DIRECT start rather than a timeout guessing at it.
  compactionStartedAt: z.string().datetime().nullable().optional(),
  compactionPercentage: z.number().int().min(0).max(100).nullable().optional(),
  compactionTokens: z.string().nullable().optional(),
  // A managed Claude Session is handing off only after Argo typed its `/handoff` command. Cleared
  // by `completeHandoffs` once the brief arrives (success) or the patience runs out (failure).
  handoffStartedAt: z.string().datetime().nullable().optional(),
  // Why the last handoff attempt did not land; cleared by the next attempt or a fresh read.
  handoffFailure: z.string().nullable().optional(),
  // The durable handoff ledger's edge for this Session, in either direction — read at every
  // discovery pass so the relationship survives a restart (ADR-0026: New Session, handoff and
  // resume are one path with three seeds).
  handoffTo: identifierSchema.nullable().optional(),
  handoffFrom: identifierSchema.nullable().optional(),
  setup: sessionSetupSchema,
})
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
