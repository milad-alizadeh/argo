import { z } from 'zod'
import { feedActivitySchema } from '@/domains/sessions/api/feed-activity'
import { ticketKey } from '@/domains/tickets/api/ticket'
import { identifierSchema } from '@/shared/validation'

const SESSION_POSTURES = ['live', 'external'] as const
const sessionPostureSchema = z.enum(SESSION_POSTURES)
const SESSION_STATUSES = [
  'starting',
  'running',
  'permission',
  'asking',
  'idle',
  'stopped',
  'ended',
  'unknown',
] as const
const sessionStatusSchema = z.enum(SESSION_STATUSES)

export type SessionPosture = z.infer<typeof sessionPostureSchema>
export type SessionStatus = z.infer<typeof sessionStatusSchema>

// CONTEXT.md L3 · Subagent, as the parent Session's transcript shows it: the events its adapter
// reported, folded by Subagent id into one entry. `state` is what the newest event says, and the
// Feed's newest row for the same Subagent says the same. Whether a running one is still running is
// a question about the parent's own status too, which is why that fold is `subagents.ts`'s.
// `startedAt` and `endedAt` are when its first event and its last `responded` were written.
const SUBAGENT_STATES = ['running', 'completed', 'failed', 'interrupted'] as const
const sessionSubagentSchema = z.strictObject({
  id: identifierSchema,
  label: z.string().nullable(),
  nickname: z.string().optional(),
  state: z.enum(SUBAGENT_STATES),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
})
export type SessionSubagent = z.infer<typeof sessionSubagentSchema>

const countSchema = z.number().int().nonnegative()
const PLAN_ENTRY_STATUSES = ['pending', 'in_progress', 'completed'] as const
const planEntryStatusSchema = z.enum(PLAN_ENTRY_STATUSES)
export type PlanEntryStatus = z.infer<typeof planEntryStatusSchema>

// CONTEXT.md L3 · Plan: newest snapshot verbatim, plus its display position; malformed is never partial.
const sessionPlanEntrySchema = z.strictObject({
  content: z.string().trim().min(1),
  position: countSchema,
  status: planEntryStatusSchema,
})
const sessionPlanSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('available'), entries: z.array(sessionPlanEntrySchema) }),
  z.strictObject({ state: z.literal('malformed') }),
])
export type SessionPlan = z.infer<typeof sessionPlanSchema>

// The newest Tool Call inside the open Turn: its canonical reader-facing label and kind, plus the
// tool's own name and the one thing it acted on as metadata. `open` is the transcript holding no
// answer to it yet, what lets the row read "Running" rather than "Ran" while the Session runs.
const sessionActivitySchema = feedActivitySchema
export type SessionActivity = z.infer<typeof sessionActivitySchema>

// The Ticket a reader asserted this Session works on (CONTEXT.md L1 · Session → Ticket), the
// fallback link ADR-0017 persists for a Session with no branch to derive one through. `title` and
// `state` are the cached echo from the moment a reader connected it, never authoritative: a screen
// that needs the current fact re-reads the Ticket through its Project's Connection.
const sessionTicketSchema = z.strictObject({
  projectId: identifierSchema,
  key: ticketKey,
  title: z.string(),
  state: z.enum(['open', 'closed']),
  createdAt: z.iso.datetime(),
})
export type SessionTicket = z.infer<typeof sessionTicketSchema>

// The newest Turn's Model, Effort and Mode, verbatim; null where no record states it yet.
const sessionTurnConfigurationSchema = z.strictObject({
  model: z.string().nullable(),
  effort: z.string().nullable(),
  mode: z.string().nullable(),
})
export type SessionTurnConfiguration = z.infer<typeof sessionTurnConfigurationSchema>

export function currentSessionId<Session extends { id: string; retiredIds: string[] }>(
  sessions: readonly Session[],
  rememberedId: string,
): string | null {
  return (
    sessions.find(
      (session) => session.id === rememberedId || session.retiredIds.includes(rememberedId),
    )?.id ?? null
  )
}
