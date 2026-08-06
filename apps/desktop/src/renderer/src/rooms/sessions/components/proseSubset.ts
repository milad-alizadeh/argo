import type { Nodes, Root } from 'mdast'
// Side-effect type import: `remark-parse` is what augments unified's `Data` with the extension
// slot `forgetConstructs` writes into, and nothing else here names anything from it.
import type {} from 'remark-parse'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { linkifyBareUrls } from './linkify'

/** micromark construct names the parser is told to forget. Disabling a construct is what makes the
 * exclusion hold BY CONSTRUCTION: its source is never tokenized, so it survives as ordinary text
 * and there is no filter that could be forgotten. Tables need no entry — GFM is never added.
 *
 * HEADINGS are no longer among them. Agents write `##` to structure an answer, and the characters
 * shown raw were a heading rendered as its own syntax — the feed's most common prose reading as the
 * one thing markdown exists to stop showing. */
const FORGOTTEN = [
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

/** The characters a node occupies, or nothing when the parser did not record where it sat — a node
 * without offsets must be left alone rather than sliced from an unknown position. */
const sourceOf = (node: Nodes, source: string): string | undefined => {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return start === undefined || end === undefined ? undefined : source.slice(start, end)
}

/** Whether a fence was closed. An unterminated one runs to the end of the record and would take
 * every later paragraph into the block with it, which is the swallowing this subset refuses. */
const isClosed = (raw: string): boolean => {
  const lines = raw.trimEnd().split('\n')
  return lines.length > 1 && /^ {0,3}(`{3,}|~{3,})\s*$/.test(lines.at(-1) ?? '')
}

/**
 * The two constructs disabling cannot handle, put back as the characters that wrote them.
 *
 * An image cannot simply be forgotten: dropping `labelStartImage` leaves the `[alt](url)` behind it
 * to match as a LINK, turning an image nobody wanted into a clickable one. An unclosed fence cannot
 * be forgotten either, because fences that DO close are read — so it is caught after parsing, by
 * the one thing that distinguishes it, and handed back as text.
 */
const literaliseWhatDisablingCannot: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file)
  visit(tree, 'image', (node, index, parent) => {
    const raw = sourceOf(node, source)
    if (parent === undefined || index === undefined || raw === undefined) return
    parent.children[index] = { type: 'text', value: raw }
  })
  visit(tree, 'code', (node, index, parent) => {
    const raw = sourceOf(node, source)
    if (parent === undefined || index === undefined || raw === undefined || isClosed(raw)) return
    parent.children[index] = { type: 'paragraph', children: [{ type: 'text', value: raw }] }
  })
}

/** The parse policy, in the order it applies. */
// ORDER IS LOAD-BEARING: `linkifyBareUrls` runs BEFORE the literalising pass, not after.
//
// Literalising hands a refused construct back as the characters that wrote it — `![alt](https://…)`
// for an image, a whole unclosed fence for a fence. Those are TEXT nodes, so a linkifier running
// afterwards finds the URLs inside them and makes them anchors, resurrecting as a link exactly what
// the subset had just refused. Running first, it sees only genuine prose: an image is still an
// `image` node and a fence still a `code` node, and neither is a text node for it to touch.
export const PROSE_SUBSET = [forgetConstructs, linkifyBareUrls, literaliseWhatDisablingCannot]
