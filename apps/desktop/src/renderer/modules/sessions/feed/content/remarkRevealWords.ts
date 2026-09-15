import type { Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// Text inside these node types keeps its normal rendering: a fenced or inline code block is
// asserted verbatim by tests, and per-word spans inside `<pre>`/`<code>` would also break
// copy-paste of the exact source.
const UNSPLIT_TYPES = new Set(['code', 'inlineCode', 'html'])

const WORD_PATTERN = /\S+\s*|\s+/g

// React mounts a `<span>` only for a word that did not exist in the previous render, so the
// per-word fade-in keyframe below plays once, on arrival, and never replays on already-shown
// words: https://streamdown.ai/docs/animation documents the same technique.
export const remarkRevealWords: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'text', (node: Text, index, parent) => {
    if (index === undefined || parent === undefined) return
    if (UNSPLIT_TYPES.has(parent.type)) return
    const words = node.value.match(WORD_PATTERN)
    if (words === null || words.length <= 1) return
    const spans = words.map(
      (word): Text => ({
        type: 'text',
        value: word,
        data: {
          hName: 'span',
          hProperties: { className: ['feed-reveal-word'] },
          hChildren: [{ type: 'text', value: word }],
        },
      }),
    )
    parent.children.splice(index, 1, ...spans)
  })
}
