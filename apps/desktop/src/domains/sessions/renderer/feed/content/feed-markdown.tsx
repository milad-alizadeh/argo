import { memo, type ReactNode, useContext, useMemo } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FeedCode } from '@/domains/sessions/renderer/feed/content/feed-code'
import {
  GalleryImage,
  GalleryParagraph,
} from '@/domains/sessions/renderer/feed/content/feed-markdown-gallery'
import {
  type HeadingTag,
  headingComponents,
} from '@/domains/sessions/renderer/feed/content/feed-markdown-headings'
import { FEED_CARD_RADIUS_CLASS } from '@/domains/sessions/renderer/feed/content/feed-surface'
import { LINK_CLASS } from '@/domains/sessions/renderer/feed/content/link-class'
import {
  MarkdownEvidence,
  type MarkdownEvidenceContextValue,
} from '@/domains/sessions/renderer/feed/content/markdown-evidence'
import { feedUrlTransform } from '@/domains/sessions/renderer/feed/content/markdown-urls'
import { MermaidFence } from '@/domains/sessions/renderer/feed/content/mermaid-fence'
import { Icon } from '@/platform/renderer/components/icon/icon'

type MarkdownNode = ExtraProps['node']

const REMARK_PLUGINS = [remarkGfm]
const LANGUAGE_CLASS = 'language-'

// A fence reaches `pre` as one `code` element holding the text, with its word as `language-*`.
function fenceOf(node: MarkdownNode) {
  const code = node?.children[0]
  if (code?.type !== 'element') return { source: '', language: undefined }
  const classes = code.properties.className
  const language = Array.isArray(classes)
    ? classes
        .map(String)
        .find((name) => name.startsWith(LANGUAGE_CLASS))
        ?.slice(LANGUAGE_CLASS.length)
    : undefined
  const source = code.children.map((child) => (child.type === 'text' ? child.value : '')).join('')
  return { source, language }
}

// An absolute path opens in the inspector, as recorded evidence does; every other link opens
// in the browser. `feedUrlTransform` has already turned what neither can open into no href.
function Link({ href, children }: { href?: string; children?: ReactNode }) {
  const context = useContext(MarkdownEvidence)
  if (!href) return <span>{children}</span>
  if (!href.startsWith('/'))
    return (
      <a href={href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
        {children}
      </a>
    )
  if (context === null) return <span>{children}</span>
  const id = `${context.rowId}:file:${href}`
  return (
    <button
      type="button"
      aria-current={context.activeEvidenceId === id ? 'location' : undefined}
      className={`inline-flex items-baseline gap-1 ${LINK_CLASS}`}
      onClick={() => context.onOpenEvidence({ shape: 'file', id, path: href })}
    >
      <Icon name="file-text" className="size-(--size-icon-inline) self-center" />
      {children}
    </button>
  )
}

type MarkdownContent = NonNullable<MarkdownNode>['children'][number]

function textOf(node: MarkdownContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

// A task item draws its own read-only checkbox, named by the item's text and out of the Tab order,
// and the `input` gfm puts first in the item draws nothing.
function ListItem({ node, children }: { node?: MarkdownNode; children?: ReactNode }) {
  const box = node?.children.find((child) => child.type === 'element' && child.tagName === 'input')
  if (box?.type !== 'element') return <li>{children}</li>
  return (
    <li>
      <input
        aria-label={node?.children.map(textOf).join('').trim()}
        type="checkbox"
        checked={box.properties.checked === true}
        readOnly
        tabIndex={-1}
        className="mr-2 accent-primary"
      />
      {children}
    </li>
  )
}

const COMPONENTS: Omit<Components, HeadingTag> = {
  p: GalleryParagraph,
  img: GalleryImage,
  a: Link,
  li: ListItem,
  ul: ({ className, children }) => (
    <ul
      className={
        className?.includes('contains-task-list') ? 'space-y-1' : 'list-disc space-y-1 pl-5'
      }
    >
      {children}
    </ul>
  ),
  ol: ({ start, children }) => (
    <ol start={start} className="list-decimal space-y-1 pl-5">
      {children}
    </ol>
  ),
  input: () => null,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 pl-4 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className={`overflow-x-auto border ${FEED_CARD_RADIUS_CLASS}`}>
      <table className="w-full text-left type-body">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  tbody: ({ children }) => <tbody className="*:border-t">{children}</tbody>,
  th: ({ style, children }) => (
    <th style={style} className="px-3 py-2 font-medium">
      {children}
    </th>
  ),
  td: ({ style, children }) => (
    <td style={style} className="px-3 py-2">
      {children}
    </td>
  ),
  pre: ({ node }) => {
    const fence = fenceOf(node)
    return fence.language === 'mermaid' ? (
      <MermaidFence node={node} source={fence.source} />
    ) : (
      <FeedCode {...fence} />
    )
  },
  // `pre` draws fenced code itself, so every `code` reaching this is inline and takes the text's size.
  code: ({ children }) => <code className="rounded-md bg-muted px-1 font-mono">{children}</code>,
  hr: () => <hr className="border-border" />,
  // The browser's `bolder` lands on 700, which shouts beside 400 body text.
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}

// An assistant's prose, or a Ticket's description, as Markdown (#1835). Raw HTML stays text, which is react-markdown's default.
// Memoized beside the row that holds it (#2386): parsing is the largest single cost in the renderer,
// and a caller that re-renders for its own reasons hands the same text back most of the time.
export const FeedMarkdown = memo(function FeedMarkdown({
  text,
  rowId,
  activeEvidenceId = null,
  headingOffset = 1,
  onOpenEvidence,
}: {
  text: string
  rowId?: string
  activeEvidenceId?: string | null
  // The Session screen's own heading is a lone `h1` (`session-shell.tsx`), so the default nests
  // markdown one level under it. A caller with a deeper ancestor passes a larger offset.
  headingOffset?: number
  onOpenEvidence?: MarkdownEvidenceContextValue['onOpenEvidence']
}) {
  // A fresh value here re-renders every fence and file link below it, whatever the text did.
  const markdownEvidence: MarkdownEvidenceContextValue | null = useMemo(
    () =>
      rowId === undefined || onOpenEvidence === undefined
        ? null
        : { rowId, activeEvidenceId, onOpenEvidence },
    [activeEvidenceId, onOpenEvidence, rowId],
  )
  const components = useMemo(
    () => ({ ...COMPONENTS, ...headingComponents(headingOffset) }),
    [headingOffset],
  )
  return (
    <div className="space-y-4 break-words type-prose [overflow-wrap:anywhere]">
      <MarkdownEvidence.Provider value={markdownEvidence}>
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          components={components}
          urlTransform={feedUrlTransform}
        >
          {text}
        </Markdown>
      </MarkdownEvidence.Provider>
    </div>
  )
})
