import { z } from 'zod'
import { identifierSchema } from '../../boundary'

export const SESSION_POSTURES = ['managed', 'external', 'orphaned'] as const
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

// CONTEXT.md L3 · Plan: the counts of the newest snapshot the agent wrote. The entries themselves
// are not carried, because nothing draws them.
const countSchema = z.number().int().nonnegative()
export const sessionPlanSchema = z.strictObject({
  total: countSchema,
  completed: countSchema,
  inProgress: countSchema,
})
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

// A shell command the Session is running now: the first line of what it was asked to run, and
// whether it was sent to the background. `command` is absent where the call carries none.
export const sessionShellCommandSchema = z.strictObject({
  id: identifierSchema,
  command: z.string().nullable(),
  background: z.boolean(),
})
export type SessionShellCommand = z.infer<typeof sessionShellCommandSchema>

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
  // Whether the reader has archived this Session. Argo keeps no flag of its own: this is the
  // Claude desktop app's own `isArchived`, joined on the CLI Session id (`sessions/archive.ts`).
  archived: z.boolean(),
  contextTokens: countSchema.nullable().optional(),
  spentTokens: countSchema.nullable().optional(),
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

// The closed set of points a Feed marks, written once and derived from.
export const FEED_MARKERS = ['compacted', 'interrupted'] as const
export const feedMarkerSchema = z.enum(FEED_MARKERS)
export type FeedMarker = z.infer<typeof feedMarkerSchema>

export const sessionFeedRowSchema = z.discriminatedUnion('shape', [
  // Laid out by Blink at the real column width, and drawn by the layout that measured it.
  z.strictObject({
    shape: z.literal('prose'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    text: z.string(),
  }),
  // A Thought (CONTEXT.md L3 · Thought): the agent's own reasoning, always the agent's, and often
  // written with its text withheld, so `text` can be empty.
  z.strictObject({ shape: z.literal('thought'), id: identifierSchema, text: z.string() }),
  // A point in the Turn sequence rather than something said in it: history condensed
  // (CONTEXT.md L3 · Compaction), or a Turn the person stopped. It carries no text of its own.
  z.strictObject({ shape: z.literal('marker'), id: identifierSchema, marker: feedMarkerSchema }),
  // The honest source fallback for content this Feed does not draw richly yet. The label is the
  // block's own type verbatim, the body is its own JSON, and neither is summarised.
  z.strictObject({
    shape: z.literal('source'),
    id: identifierSchema,
    role: z.enum(['user', 'assistant']),
    label: z.string(),
    source: z.string(),
  }),
  // A transcript line Argo could not read. Drawn rather than dropped, so a damaged file reads as
  // damaged instead of as a shorter Session. Its height is arithmetic; see UNREADABLE_ROW.
  z.strictObject({ shape: z.literal('unreadable'), id: identifierSchema }),
])
export type SessionFeedRow = z.infer<typeof sessionFeedRowSchema>

// The stated height formula for the one row shape Blink does not lay out from content
// (ADR-0033 rule 1). Drawn height is `padding * 2 + itemHeight`, the row's own padding around the
// error Item it holds, and the packaged proof asserts
// the formula equals the drawn box. It lives beside the row shape rather than in the agent that
// projects rows or the component that draws one, because both read it and neither owns it.
export const UNREADABLE_ROW = { paddingBlock: 4, itemHeight: 36 }

export function unreadableRowHeight(): number {
  return UNREADABLE_ROW.paddingBlock * 2 + UNREADABLE_ROW.itemHeight
}
