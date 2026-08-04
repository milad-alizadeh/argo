import type { MediaResult, ToolCall, ToolCallStatus, Turn } from './runtimeTree'

// How an image the agent looked at reads in the feed, and how many of a Turn's images are decoded at
// once. Split from `feedCalls.ts`'s loud/quiet policy because the DECODE BOUND is a different kind of
// rule from the fold — it is about what the surface can afford to hold, not about what is worth a row.

/** An image the agent looked at, shown inline.
 *
 * Loud, for the same reason a mutation is: it is the one thing a terminal cannot do at all, and a
 * screenshot folded into `read 4` is a visual debugging loop you have to leave the surface to follow.
 *
 * There is no running state here, and deliberately: a row exists because a RESULT came back carrying
 * pixels, and until one does nothing about the call says it will produce a picture. A screenshot being
 * taken is a read like any other and sits in the quiet fold until it lands. */
export interface MediaRowModel {
  kind: 'media'
  key: string
  /** What the call named the image by — a file path for a read, a URL for a fetch, and `null` where
   * the record named nothing. The row's subject, not necessarily a path on this disk. */
  subject: string | null
  /** `completed`, or `failed` for a call that broke and still returned what it had looked at. */
  status: ToolCallStatus
  media: MediaResult
  /** Whether the pixels are shown without asking — see `OPEN_MEDIA_BOUND`. */
  open: boolean
}

/**
 * How many of a Turn's media rows show their pixels without being asked.
 *
 * A bound, because DECODED pixels are the cost: a full-window screenshot is a third of a megabyte of
 * base64 and roughly twenty-eight megabytes of bitmap, so a turn that took thirty of them would hold
 * most of a gigabyte for the two you are looking at. The MOST RECENT few, because a visual debugging
 * loop is followed downward — the newest shot is the one the paragraph under it is about. Older rows
 * keep their frame, their path and their affordance, and decode when asked.
 *
 * Counted per TURN rather than per session because a turn is what the feed mounts: the Activity
 * surface shows one exchange at a time, so a turn's bound IS the bound on what is decoded at once.
 */
const OPEN_MEDIA_BOUND = 4

const isMedia = (call: ToolCall): boolean => call.result?.kind === 'media'

/** The calls of a Turn whose pixels are shown without asking: the last few that produced any.
 * Read off `toolCalls`, which is already in emission order, so recency needs no second sort. */
export function openMediaIds(turn: Turn): Set<string> {
  const shown = turn.toolCalls.filter(isMedia)
  return new Set(shown.slice(-OPEN_MEDIA_BOUND).map((call) => call.id))
}

/** The row for a call that came back with pixels, or `null` for one that did not — which is what makes
 * `media` non-optional on the row: the caller has already established there is a picture, so nothing
 * downstream has to handle a media row with no media. */
export function mediaRow(call: ToolCall, open: boolean): MediaRowModel | null {
  if (call.result?.kind !== 'media') return null
  return {
    kind: 'media',
    key: `media:${call.id}`,
    subject: call.target,
    status: call.status,
    media: call.result,
    open,
  }
}
