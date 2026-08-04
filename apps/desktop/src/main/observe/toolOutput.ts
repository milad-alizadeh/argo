import type { OutputResult } from '../../shared'
import { asArray, asString, isRecord } from './untrusted'

// A call's result → what it PRINTED, read off the `tool_result` part that answered it. DIRECT: the
// bytes the agent got back, carried verbatim and never reworded.

/** The prose of one result part. A part of any other kind belongs to the kind that owns it — an
 * image is media, which a row reads as pixels rather than as a base64 blob printed to the screen. */
function partText(part: unknown): string | null {
  return isRecord(part) && part.type === 'text' ? asString(part.text) : null
}

/**
 * A `tool_result`'s content → the output it carried, or `null` where it carried none.
 *
 * A result is a plain string most of the time and an array of content parts when it held more than
 * prose, so both are read. Whitespace alone is `null` rather than an empty output: a row with
 * nothing to show must say so, and an expandable that opens onto a blank block is a row that lied
 * about having something behind it.
 */
export function outputResultFrom(content: unknown): OutputResult | null {
  const raw =
    asString(content) ??
    asArray(content)
      .map(partText)
      .filter((text) => text !== null)
      .join('\n')
  return raw.trim() === '' ? null : { kind: 'output', tier: 'direct', text: raw }
}
