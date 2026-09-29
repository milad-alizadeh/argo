import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const REMARK_PLUGINS = [remarkGfm]
// A link would nest a control inside the title's own button, so it keeps only its text.
const INLINE_ELEMENTS = ['p', 'strong', 'em', 'del', 'code']

const COMPONENTS: Components = {
  p: ({ children }) => <span>{children} </span>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }) => <code className="rounded-md bg-muted px-1 font-mono">{children}</code>,
}
// The shimmer paints through the text, so a code ground would cover its letters.
const SHIMMERING_COMPONENTS: Components = {
  ...COMPONENTS,
  code: ({ children }) => <code className="font-mono">{children}</code>,
}

// One line of Markdown inside a single-line title: emphasis and code draw, every block unwraps.
export const FeedInlineMarkdown = memo(function FeedInlineMarkdown({
  shimmering = false,
  text,
}: {
  shimmering?: boolean
  text: string
}) {
  return (
    <Markdown
      allowedElements={INLINE_ELEMENTS}
      components={shimmering ? SHIMMERING_COMPONENTS : COMPONENTS}
      remarkPlugins={REMARK_PLUGINS}
      unwrapDisallowed
    >
      {text}
    </Markdown>
  )
})
