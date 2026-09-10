import type { ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import '../feed/markdown.css'

// A link is drawn as its text. The Feed runs in the app's own renderer, where following an
// anchor would navigate the cockpit away from itself, and a transcript is not a page to browse.
function LinkText({ children }: { children?: ReactNode }) {
  return <span className="feed-md__link">{children}</span>
}

const COMPONENTS: Components = { a: LinkText }

// An image would load after the measure pass read the row's height and then draw taller than
// that height (ADR-0033 rule 2), so it is not drawn; its alt text is not either, because the
// row has no way to say it is standing in for a picture.
const NOT_DRAWN = ['img']

// What Claude wrote, drawn as the Markdown it was written in. The measure pass lays this out the
// same way the Feed shows it, so its height is read off the drawn element like any other row.
export function FeedMarkdown({ text }: { text: string }) {
  return (
    <div className="feed-md">
      <Markdown components={COMPONENTS} disallowedElements={NOT_DRAWN} remarkPlugins={[remarkGfm]}>
        {text}
      </Markdown>
    </div>
  )
}
