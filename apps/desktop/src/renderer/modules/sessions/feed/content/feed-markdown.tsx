import type { ReactNode } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { SessionDiagramEvidence } from '../../types'
import { FeedCode } from './feed-code'
import { GalleryImage, GalleryParagraph } from './feed-markdown-gallery'
import { FEED_CARD_RADIUS_CLASS } from './feed-surface'
import { feedUrlTransform } from './markdown-urls'
import { DiagramEvidence, type DiagramEvidenceContextValue, MermaidFence } from './mermaid-fence'

type MarkdownNode = ExtraProps['node']

const REMARK_PLUGINS = [remarkGfm]
// The wrapper carries `type-prose`: on the heading itself its doubled selector drops the weight.
const HEADING_CLASS = 'mb-2 font-medium'
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

function Link({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <span>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground"
    >
      {children}
    </a>
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

const COMPONENTS: Components = {
  p: GalleryParagraph,
  img: GalleryImage,
  a: Link,
  li: ListItem,
  h1: ({ children }) => <h3 className={HEADING_CLASS}>{children}</h3>,
  h2: ({ children }) => <h4 className={HEADING_CLASS}>{children}</h4>,
  h3: ({ children }) => <h5 className={HEADING_CLASS}>{children}</h5>,
  h4: ({ children }) => <h6 className={HEADING_CLASS}>{children}</h6>,
  h5: ({ children }) => <h6 className={HEADING_CLASS}>{children}</h6>,
  h6: ({ children }) => <h6 className={HEADING_CLASS}>{children}</h6>,
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
export function FeedMarkdown({
  text,
  rowId,
  activeEvidenceId = null,
  onOpenEvidence,
}: {
  text: string
  rowId?: string
  activeEvidenceId?: string | null
  onOpenEvidence?: (evidence: SessionDiagramEvidence) => void
}) {
  const diagramEvidence: DiagramEvidenceContextValue | null =
    rowId === undefined || onOpenEvidence === undefined
      ? null
      : { rowId, activeEvidenceId, onOpenEvidence }
  return (
    <div className="space-y-4 break-words type-prose [overflow-wrap:anywhere]">
      <DiagramEvidence.Provider value={diagramEvidence}>
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          components={COMPONENTS}
          urlTransform={feedUrlTransform}
        >
          {text}
        </Markdown>
      </DiagramEvidence.Provider>
    </div>
  )
}
