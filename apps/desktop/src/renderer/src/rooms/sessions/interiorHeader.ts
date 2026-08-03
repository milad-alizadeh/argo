import { isSteerable, type SessionView } from '@shared'
import { deliveryState } from '@/shared/status'
import { contextPercent } from './contextEstimate'

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

/** One segment of the meta line, in the fixed order the spec sets. `mono` marks the segments that
 * carry an identifier (a model id, a branch) rather than prose. */
export interface MetaSegment {
  id: 'status' | 'model' | 'mode' | 'branch' | 'elapsed'
  text: string
  mono: boolean
}

/** The navigable ticket link. `text` never echoes the title: a ticket-titled session collapses to
 * `#42`, so the chip stays the jump and stops being a second copy of the name. */
export interface IntentChip {
  number: number
  text: string
}

export interface SessionHeaderModel {
  title: string
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
  if (session.facts.status === 'running' || nowMs === null) return null
  if (session.lastActivityAt === null) return null
  const minutes = Math.floor((nowMs - session.lastActivityAt) / 60_000)
  if (minutes < 0) return null
  return minutes < 60 ? `idle ${minutes}m` : `idle ${Math.floor(minutes / 60)}h`
}

// The branch segment sheds the branch NAME once there is something to say about it — the top bar's
// git group already names the checked-out branch and the roster row already named this session's,
// so what is worth the width here is what changed against it.
function branchSegment(session: SessionView): string | null {
  const { dirty, unpushed } = session.facts
  const parts: string[] = []
  if (dirty > 0) parts.push(`${dirty}∆`)
  if (unpushed > 0) parts.push(`↑${unpushed}`)
  return parts.length === 0 ? session.branch : parts.join(' ')
}

function segment(id: MetaSegment['id'], text: string | null, mono = false): MetaSegment[] {
  return text === null ? [] : [{ id, text, mono }]
}

/** The meta line, in the ONE fixed order `status · model · mode · branch(+∆/↑) · elapsed`. A
 * segment Argo cannot establish is absent rather than filled in, except the model and the mode,
 * whose absence is itself worth saying out loud. */
export function metaSegments(
  session: SessionView,
  link: SessionLink,
  nowMs: number | null,
): MetaSegment[] {
  const { rail } = deliveryState(session.facts, session.posture)
  return [
    ...segment('status', rail.word),
    ...segment('model', session.model ?? UNKNOWN, true),
    ...segment('mode', link.mode ?? UNKNOWN),
    ...segment('branch', branchSegment(session), true),
    ...segment('elapsed', elapsed(session, nowMs)),
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
    contextPercent: contextPercent(session),
    meta: metaSegments(session, link, nowMs),
    intent: intentChip(session, link),
    external: !isSteerable(session.posture),
  }
}
