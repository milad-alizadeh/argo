import type { PhrasingContent, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// Bare URLs, made clickable — in the agent's prose and in your own prompt alike.
//
// Neither was. Markdown's `[text](url)` has always worked, but agents overwhelmingly write the URL
// itself and people paste one, and both landed as inert text you had to select and copy. The two
// constructs that would have covered it are both deliberately unavailable: `autolink` (the
// `<https://x>` form) is in the parser's FORGOTTEN list, and GFM's literal-autolink comes bundled
// with tables and strikethrough that this prose subset exists to exclude. So the smallest thing
// that closes the gap is this — one pattern, applied in one place, adding nothing else.

/** A URL in running text.
 *
 * The trailing-punctuation class is the whole difficulty: `see https://x/y.` and `(https://x/y)`
 * are the two ways a URL actually appears in a sentence, and swallowing the full stop or the
 * closing paren produces a link that 404s. A closing paren is only dropped when the URL holds no
 * opening one, so a wiki-style `…/Foo_(bar)` survives intact. */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/g

/** One URL, trimmed of the punctuation that ended the sentence rather than the address. */
function trimTrailing(url: string): string {
  const trimmed = url.replace(/[.,;:!?]+$/, '')
  return trimmed.endsWith(')') && !trimmed.includes('(') ? trimmed.slice(0, -1) : trimmed
}

/** One piece of a linkified string: a run of plain text, or a URL to make an anchor of. */
export interface TextPiece {
  text: string
  href: string | null
  /** Where this piece starts in the string it was cut from. A stable identity for a list key — the
   * position is unique by construction, where the text is not (a prompt can repeat a URL) and the
   * array index is not stable if the string is ever re-split. */
  at: number
}

/**
 * Split running text into plain runs and URLs.
 *
 * Shared by the prose renderer and the prompt row so the two cannot disagree about what a link is —
 * the prompt is rendered as plain text on purpose (it is typed input and carried no markup intent),
 * which is exactly why it needs this rather than a markdown pass.
 */
export function textPieces(value: string): TextPiece[] {
  const pieces: TextPiece[] = []
  let cursor = 0
  for (const match of value.matchAll(URL_PATTERN)) {
    const start = match.index
    const href = trimTrailing(match[0])
    if (start > cursor) pieces.push({ text: value.slice(cursor, start), href: null, at: cursor })
    pieces.push({ text: href, href, at: start })
    cursor = start + href.length
  }
  if (cursor < value.length) pieces.push({ text: value.slice(cursor), href: null, at: cursor })
  return pieces
}

/** One piece as the mdast node it becomes. */
const nodeOf = (piece: TextPiece): PhrasingContent =>
  piece.href === null
    ? { type: 'text', value: piece.text }
    : { type: 'link', url: piece.href, children: [{ type: 'text', value: piece.text }] }

/**
 * The same reading as an mdast pass, so the prose renderer's existing link component handles it.
 *
 * Text inside a `link` is skipped: a URL used as the visible text of a markdown link would
 * otherwise be re-split and nested inside its own anchor.
 */
export const linkifyBareUrls: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'text', (node, index, parent) => {
    if (parent === undefined || index === undefined || parent.type === 'link') return
    const pieces = textPieces(node.value)
    if (pieces.length === 1 && pieces[0]?.href === null) return
    parent.children.splice(index, 1, ...pieces.map(nodeOf))
    // Skip what was just inserted — revisiting the new text nodes would rescan them forever.
    return index + pieces.length
  })
}
