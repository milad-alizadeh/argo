// The Console's vocabulary (cockpit-matrix.md R13): the console is `session · live` plus
// AT MOST ONE capture slot. That invariant is carried by the types here — a capture is a
// single optional object, never a list — so no surface can accumulate tabs.

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

/** The ONE format a capture tab reads in. A capture is time-keyed raw I/O, so its label
 * carries the moment it was captured — that is what tells two runs of the same tool apart.
 * 24-hour and zero-padded rather than locale-formatted: the tab is a fixed-width column. */
export function captureLabel(name: string, at: Date): string {
  const hours = String(at.getHours()).padStart(2, '0')
  const minutes = String(at.getMinutes()).padStart(2, '0')
  return `${name} @${hours}:${minutes}`
}

/** Which channel the Console actually shows. The capture slot is owned by the screen, so
 * the selection can name a capture that has since been replaced or cleared (✕) — every
 * such case falls back to live rather than rendering an empty panel. */
export function resolveActiveChannel(activeChannel: string, capture?: ConsoleCapture): string {
  return capture !== undefined && activeChannel === capture.id ? capture.id : LIVE_CHANNEL_ID
}

/** The marker an agent-emitted feed line opens with. Part of the captured text, tinted on
 * render so a command reads apart from its output. */
export const FEED_MARKER = '▸'

export type FeedLine = {
  /** The line opened with the marker, which renders tinted ahead of the text. */
  marker: boolean
  /** The line with its marker taken off — what actually reads. */
  text: string
}

/** Split a feed into lines, lifting the leading marker off each one. Blank lines survive
 * as empty text so the feed's own spacing is preserved. */
export function feedLines(feed: string): FeedLine[] {
  const prefix = `${FEED_MARKER} `
  return feed.split('\n').map((line) => {
    const marker = line.startsWith(prefix)
    return { marker, text: marker ? line.slice(prefix.length) : line }
  })
}
