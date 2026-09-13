export const SESSION_POSTURES = ['managed', 'external', 'orphaned'] as const
export const SESSION_ENTRIES = ['interactive', 'headless'] as const
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
export const TITLE_SOURCES = ['custom', 'summarised', 'first-prompt'] as const

export type SessionPosture = (typeof SESSION_POSTURES)[number]
export type SessionEntry = (typeof SESSION_ENTRIES)[number]
export type SessionStatus = (typeof SESSION_STATUSES)[number]
export type SessionTitle = { text: string; source: (typeof TITLE_SOURCES)[number] }

// CONTEXT.md L3 · Subagent, as the parent Session's transcript shows it: the Tool Call that spawned
// it, with the label that call gave it, absent rather than invented where the call carried none.
// `landed` is whether the call's result came back. Whether an unlanded one is still running is a
// question about the parent's own status too, which is why that fold is `delegation.ts`'s.
export type SessionDelegation = { id: string; label: string | null; landed: boolean }

// CONTEXT.md L3 · Plan: the counts of the newest snapshot the agent wrote. The entries themselves
// are not carried, because nothing draws them.
export type SessionPlan = { total: number; completed: number; inProgress: number }

// The newest Tool Call inside the open Turn: the tool's own name, and the one thing it acted on,
// read off its input rather than summarised.
export type SessionActivity = { tool: string; target: string | null }

// The newest pull request the CLI linked this Session to, as its own `pr-link` record states it.
// Its state (open, merged, closed, draft) is the code host's fact (CONTEXT.md L4 · Delivery), and
// no transcript holds it.
export type SessionPullRequest = { number: number; url: string; repository: string | null }

// A shell command the Session is running now: the first line of what it was asked to run, and
// whether it was sent to the background. `command` is absent where the call carries none.
export type SessionShellCommand = { id: string; command: string | null; background: boolean }

export type SessionRosterRow = {
  id: string
  retiredIds: string[]
  cli: string
  posture: SessionPosture
  title: SessionTitle | null
  status: SessionStatus
  entry: SessionEntry
  cwd: string | null
  branch: string | null
  updatedAt: string | null
  unreadableLines: number
  originUnread: boolean
  // When the prompt that opened the newest Turn was written (CONTEXT.md L3 · Turn).
  turnStartedAt: string | null
  activity: SessionActivity | null
  plan: SessionPlan | null
  delegations: SessionDelegation[]
  // The shell commands running now, read off `Bash` calls with no result (`sessions/signals.ts`).
  shell: SessionShellCommand[]
  pullRequest: SessionPullRequest | null
  // Whether the reader has archived this Session. Argo keeps no flag of its own: this is the
  // Claude desktop app's own `isArchived`, joined on the CLI Session id (`sessions/archive.ts`).
  archived: boolean
  contextTokens?: number | null
  spentTokens?: number | null
}

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
export type FeedMarker = (typeof FEED_MARKERS)[number]

export type SessionFeedRow =
  // Laid out by Blink at the real column width, and drawn by the layout that measured it.
  | { shape: 'prose'; id: string; role: 'user' | 'assistant'; text: string }
  // A Thought (CONTEXT.md L3 · Thought): the agent's own reasoning, always the agent's, and often
  // written with its text withheld, so `text` can be empty.
  | { shape: 'thought'; id: string; text: string }
  // A point in the Turn sequence rather than something said in it: history condensed
  // (CONTEXT.md L3 · Compaction), or a Turn the person stopped. It carries no text of its own.
  | { shape: 'marker'; id: string; marker: FeedMarker }
  // The honest source fallback for content this Feed does not draw richly yet. The label is the
  // block's own type verbatim, the body is its own JSON, and neither is summarised.
  | { shape: 'source'; id: string; role: 'user' | 'assistant'; label: string; source: string }
  // A transcript line Argo could not read. Drawn rather than dropped, so a damaged file reads as
  // damaged instead of as a shorter Session. Its height is arithmetic; see UNREADABLE_ROW.
  | { shape: 'unreadable'; id: string }

// The stated height formula for the one row shape Blink does not lay out from content
// (ADR-0033 rule 1). Drawn height is `padding * 2 + itemHeight`, the row's own padding around the
// error Item it holds, and the packaged proof asserts
// the formula equals the drawn box. It lives beside the row shape rather than in the agent that
// projects rows or the component that draws one, because both read it and neither owns it.
export const UNREADABLE_ROW = { paddingBlock: 4, itemHeight: 36 }

export function unreadableRowHeight(): number {
  return UNREADABLE_ROW.paddingBlock * 2 + UNREADABLE_ROW.itemHeight
}
