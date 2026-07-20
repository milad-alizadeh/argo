// The Console's vocabulary (cockpit-matrix.md R13): `session · live` plus AT MOST ONE
// capture slot. The invariant is carried by the types — a capture is a single optional
// object, never a list — so no surface can accumulate tabs.

/** The fixed channel. It always exists, never closes, and is what `Esc` and the live tab
 * return to. */
export const LIVE_CHANNEL_ID = 'live'

/** The live channel's one label. Written once here so the tab, the capture note and any
 * empty copy cannot drift apart. */
export const LIVE_CHANNEL_LABEL = 'session · live'

export const CONSOLE_CHANNEL_KINDS = ['live', 'capture'] as const

/** `live` is the session's own channel; `capture` is the replaceable slot a tool or agent
 * feed lands in. */
export type ConsoleChannelKind = (typeof CONSOLE_CHANNEL_KINDS)[number]

/** The single capture slot's contents. Opening another feed REPLACES this value (R13). */
export type ConsoleCapture = {
  /** The id of the row whose feed this is — a tab reports it back on select and close. */
  id: string
  /** Timestamped, per `captureLabel` — `vitest @12:04`. */
  label: string
  /** The raw feed, newline-separated. Rendered as text, never as markup. */
  feed: string
  /** The feed came from an Agent, so its tab carries the sparkle that marks AI presence. */
  agent?: boolean
}

/** What the live channel shows: the tail of the session's output, then its prompt. */
export type ConsoleLiveChannel = {
  /** The prompt line, tinted and followed by the static caret — `auth refactor $`. */
  prompt: string
  /** The output above the prompt. The live channel alone carries a tail (R13). */
  tail: string
}

/** The marker an agent-emitted feed line opens with. This is captured TEXT, not an icon:
 * it arrives inside the feed string and is only re-tinted on render. */
export const FEED_MARKER = '▸'

export type FeedLine = {
  /** The line opened with the marker, which renders tinted ahead of the text. */
  marker: boolean
  /** The line with its marker taken off — what actually reads. */
  text: string
}
