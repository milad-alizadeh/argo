import { isSteerable, type SessionView } from '@shared'
import { deliveryState } from '@/shared/status'
import type { ActivityDot } from './activityStates'
import { contextPercent, sessionUsage } from './contextEstimate'
import { relativeAge } from './relativeAge'

// The session header's derivation: the one band's title, its context ring, its meta line and its
// intent chip. Pure and React-free — the header is glance-only, so every judgement it makes (which
// fact is observable, which segment degrades away) is arithmetic asserted in a unit test rather
// than a branch inside a View.

/** A fact Argo could not establish reads `unknown` — never a default, never invented
 * (`cockpit-failure-states-spec.md` §8). */
const UNKNOWN = 'unknown'

/** How the title was resolved (`cockpit-spec.md` §4.2): explicit name → linked ticket →
 * conversation-derived. Resolved upstream by the observer; the header only reads it, which is what
 * keeps the rail and the header from ever disagreeing. */
export type TitleSource = 'explicit' | 'ticket' | 'derived'

/** The Work Item a session is working against. */
export interface SessionIntent {
  number: number
  title: string
}

/** The session's autonomy mode (`CONTEXT.md`, Autonomy cluster). */
export type SessionMode = 'Ask' | 'Plan' | 'Code'

/** What the projection has not enriched yet (Seam B): how the title was resolved, the linked
 * ticket, and the session's mode. Honest-null in the app, fixtures in the stories — the header
 * degrades each segment rather than fabricating it. */
export interface SessionLink {
  titleSource: TitleSource
  intent: SessionIntent | null
  mode: SessionMode | null
}

export const noSessionLink = (): SessionLink => ({
  titleSource: 'derived',
  intent: null,
  mode: null,
})

/** One segment of the meta line — prose, or the branch with whatever has changed against it.
 *
 * `status` and `model` are deliberately NOT members. The band sheds every fact the roster rail
 * already carries: the rail row names the model and spells the status word, so repeating them here
 * buys nothing and costs the line its scannability. The status survives as the dot beside the
 * segments — a state one glyph can carry does not need a word too.
 *
 * The branch case carries what changed as NUMBERS, never as a rendered string: how a count is drawn
 * (an icon and a number) is the View's business, and a derivation that formats one is presentation
 * living in a model. */
export type MetaSegment =
  | { id: 'mode' | 'elapsed' | 'tokens'; text: string }
  | { id: 'branch'; text: string; dirty: number; unpushed: number }

/** The navigable ticket link. `text` never echoes the title: a ticket-titled session collapses to
 * `#42`, so the chip stays the jump and stops being a second copy of the name. */
export interface IntentChip {
  number: number
  text: string
}

export interface SessionHeaderModel {
  title: string
  /** The session's state, as the dot the band leads with. The room's own dot vocabulary rather than
   * the rail's wider one: this reads the same three channels the rest of the interior does, so a
   * roster row and its open plane can never disagree about what the session is doing. */
  status: ActivityDot
  /** Share of the context window in use, or `null` for a session whose context Argo cannot
   * establish — the ring then draws NO arc and reads `unknown`. */
  contextPercent: number | null
  meta: readonly MetaSegment[]
  intent: IntentChip | null
  /** Argo only observes this session: no ring, no intent, and nothing to steer. */
  external: boolean
}

// `elapsed` is only claimed where it is observable. A running session's turn start is not in the
// runtime tree, so the segment degrades away rather than reporting the age of the last record as
// though it were the turn's duration; a session at rest genuinely has been at rest that long.
function elapsed(session: SessionView, nowMs: number | null): string | null {
  if (session.facts.status === 'running') return null
  const age = relativeAge(session.lastActivityAt, nowMs)
  return age === null ? null : `idle ${age}`
}

// The branch and what has changed against it, together: the deltas are what is worth the width here,
// but they are what changed against a NAME, and a session whose branch the header will not say is a
// session you cannot place. Dropped whole where there is no branch — deltas belong to one.
function branchSegment(session: SessionView): MetaSegment[] {
  if (session.branch === null) return []
  const { dirty, unpushed } = session.facts
  return [{ id: 'branch', text: session.branch, dirty, unpushed }]
}

// Every token the session has been observed to spend — the input side, the output side and both
// cache lines, because what this answers is "what has this cost", not "what is in the window" (the
// ring's separate question, which deliberately drops output). `Intl` does the compacting: 48k is a
// locale-aware format, not a divide-by-a-thousand.
const COMPACT = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

function tokens(session: SessionView): string | null {
  const usage = sessionUsage(session)
  if (usage === null) return null
  const total =
    usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens
  return total === 0 ? null : `${COMPACT.format(total)} tokens`
}

function segment(id: 'mode' | 'elapsed' | 'tokens', text: string | null): MetaSegment[] {
  return text === null ? [] : [{ id, text }]
}

/** The meta line, in the ONE fixed order `mode · branch(+counts) · elapsed · tokens`, led by the dot the
 * model carries separately. A segment Argo cannot establish is absent rather than filled in, except
 * the mode, whose absence is itself worth saying out loud. */
export function metaSegments(
  session: SessionView,
  link: SessionLink,
  nowMs: number | null,
): MetaSegment[] {
  return [
    ...segment('mode', link.mode ?? UNKNOWN),
    ...branchSegment(session),
    ...segment('elapsed', elapsed(session, nowMs)),
    ...segment('tokens', tokens(session)),
  ]
}

// The chip is dropped whole for a session Argo only observes: external sessions are read-only, so
// there is no intent to link and no jump to offer.
function intentChip(session: SessionView, link: SessionLink): IntentChip | null {
  if (!isSteerable(session.posture) || link.intent === null) return null
  const { number, title } = link.intent
  return {
    number,
    text: link.titleSource === 'ticket' ? `#${number}` : `intent #${number} ${title}`,
  }
}

/**
 * The header's whole view-model. The title arrives resolved — the fallback chain is the observer's
 * job — so nothing here can rewrite it turn to turn.
 */
export function buildInteriorHeader({
  session,
  link = noSessionLink(),
  nowMs = null,
}: {
  session: SessionView
  link?: SessionLink
  /** Wall clock, injected so the derivation stays pure. `null` drops the elapsed segment. */
  nowMs?: number | null
}): SessionHeaderModel {
  return {
    title: session.title,
    status: deliveryState(session.facts, session.posture).rail.dot,
    contextPercent: contextPercent(session),
    meta: metaSegments(session, link, nowMs),
    intent: intentChip(session, link),
    external: !isSteerable(session.posture),
  }
}
