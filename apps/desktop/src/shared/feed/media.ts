import type { MediaResult, ToolCall, ToolCallStatus } from '../runtimeTree'

// How an image the agent looked at reads in the feed. Split from `feedCalls.ts`'s loud/quiet policy
// because what makes a picture worth a row is a different question from what makes a call worth one.
//
// There is no decode bound here any more, and none is needed: every row's body is closed until it is
// asked for, so a turn of thirty screenshots holds no bitmaps at all rather than the four most
// recent. The bound existed to cap what the surface was holding; closed-by-default caps it at zero,
// which is both simpler and a stronger guarantee than the bound ever gave.

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
}

/** The row for a call that came back with pixels, or `null` for one that did not — which is what makes
 * `media` non-optional on the row: the caller has already established there is a picture, so nothing
 * downstream has to handle a media row with no media. */
export function mediaRow(call: ToolCall): MediaRowModel | null {
  if (call.result?.kind !== 'media') return null
  return {
    kind: 'media',
    key: `media:${call.id}`,
    subject: call.target,
    status: call.status,
    media: call.result,
  }
}
