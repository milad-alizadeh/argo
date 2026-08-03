import type { Root } from 'mdast'
// Side-effect type import: `remark-parse` is what augments unified's `Data` with the extension
// slot `forgetConstructs` writes into, and nothing else here names anything from it.
import type {} from 'remark-parse'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// WHICH markdown the feed reads, decided at the PARSER rather than after the fact. Everything a
// post-render filter would have to strip is instead never tokenized, so there is no window in which
// the excluded element exists and no filter to forget to apply (issue 315).
//
// Excluded and why: headings, because the feed owns its own heading hierarchy and agent prose
// emitting `##` would compete with it; remote images, because a desktop app fetching URLs out of
// model-written text is a hazard; tables, blockquotes, rules and indented code, because they are
// rare enough in agent prose that reading them costs more than showing the characters. GFM is
// simply never added, which is what keeps tables (and strikethrough, and literal autolinks) out.

/** micromark construct names the parser is told to forget. Each one, once disabled, leaves its
 * source as ordinary text — which is exactly the degradation this feed wants. */
const FORGOTTEN = [
  'headingAtx',
  'setextUnderline',
  'codeIndented',
  'htmlFlow',
  'htmlText',
  'blockQuote',
  'thematicBreak',
  'characterReference',
  'autolink',
  'definition',
]

const forgetConstructs: Plugin<[], Root> = function forgetConstructs() {
  const data = this.data()
  data.micromarkExtensions ??= []
  data.micromarkExtensions.push({ disable: { null: FORGOTTEN } })
}

/**
 * Images, put back as the characters that wrote them.
 *
 * The one construct disabling does not handle: dropping `labelStartImage` leaves the `[alt](url)`
 * behind it to match as a LINK, turning an image nobody wanted into a clickable one. So the image
 * is parsed and then replaced by the slice of source it occupies — its own text, not a
 * reconstruction — before any element is built for it.
 */
const literaliseImages: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file)
  visit(tree, 'image', (node, index, parent) => {
    if (parent === undefined || index === undefined || node.position === undefined) return
    const { start, end } = node.position
    parent.children[index] = { type: 'text', value: source.slice(start.offset, end.offset) }
  })
}

/** The parse policy, in the order it applies: forget the constructs, then put images back as text. */
export const PROSE_SUBSET = [forgetConstructs, literaliseImages]
