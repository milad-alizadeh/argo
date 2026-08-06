import { isSteerable, rootAgent, type SessionView } from '@shared'
import { deliveryState } from '@/shared/status'
import { contextPercent, sessionUsage, tokenSpend } from '../usage/contextEstimate'
import { duration } from '../usage/sessionClock'
import type { ActivityDot } from './activityStates'

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
  | { id: 'mode' | 'duration' | 'tokens'; text: string }
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

// Everything the session has been observed to spend, its delegates' share included — the header has
// the width to name the unit, which is why the bare count arrives without one.
function tokens(session: SessionView): string | null {
  const spend = tokenSpend(sessionUsage(session))
  return spend === null ? null : `${spend} tokens`
}

// The session's whole working span — its first prompt to its last stop, or to the wall clock while
// it is still going. The SPAN and nothing else: the dot beside it already says whether the session
// is still going, so a verb in front of the number is a second copy of the status, and the second
// reading beside it (how long it had been idle) was a different clock wearing the same units.
function ran(session: SessionView, nowMs: number | null): string | null {
  const root = rootAgent(session.agents)
  if (root === null) return null
  return duration(root.startedAtMs, root.endedAtMs, nowMs)
}

// The branch and what has changed against it, together: the deltas are what is worth the width here,
// but they are what changed against a NAME, and a session whose branch the header will not say is a
// session you cannot place. Dropped whole where there is no branch — deltas belong to one.
function branchSegment(session: SessionView): MetaSegment[] {
  if (session.branch === null) return []
  const { dirty, unpushed } = session.facts
  return [{ id: 'branch', text: session.branch, dirty, unpushed }]
}

function segment(id: 'mode' | 'duration' | 'tokens', text: string | null): MetaSegment[] {
  return text === null ? [] : [{ id, text }]
}

/** The meta line, in the ONE fixed order `mode · branch(+counts) · duration · tokens`, led by the
 * dot the model carries separately. A segment Argo cannot establish is absent rather than filled
 * in, except the mode, whose absence is itself worth saying out loud. */
export function metaSegments(
  session: SessionView,
  link: SessionLink,
  nowMs: number | null,
): MetaSegment[] {
  return [
    ...segment('mode', link.mode ?? UNKNOWN),
    ...branchSegment(session),
    ...segment('duration', ran(session, nowMs)),
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
  /** Wall clock, injected so the derivation stays pure. `null` drops the duration of a session
   * still running, which has no end to measure against. */
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
