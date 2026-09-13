import { createContext, type ReactNode, useContext } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FeedCode } from './FeedCode'
import { FeedGallery, FeedImage } from './FeedImages'
import { FEED_CARD_RADIUS_CLASS } from './feedSurface'
import { feedUrlTransform } from './markdownUrls'

type MarkdownNode = ExtraProps['node']

const REMARK_PLUGINS = [remarkGfm]
// The wrapper carries `type-prose`: on the heading itself its doubled selector drops the weight.
const HEADING_CLASS = 'mb-2 font-medium'
const LANGUAGE_CLASS = 'language-'

// True inside a paragraph drawn as a gallery, so its images do not each open their own row.
const InGallery = createContext(false)

function elementsOf(node: MarkdownNode) {
  return (node?.children ?? []).filter(
    (child) => child.type === 'element' || (child.type === 'text' && child.value.trim() !== ''),
  )
}

function holdsOnlyImages(node: MarkdownNode) {
  const children = elementsOf(node)
  return (
    children.length > 0 &&
    children.every((child) => child.type === 'element' && child.tagName === 'img')
  )
}

function holdsImage(node: MarkdownNode) {
  return elementsOf(node).some((child) => child.type === 'element' && child.tagName === 'img')
}

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

function Paragraph({ node, children }: { node?: MarkdownNode; children?: ReactNode }) {
  if (holdsOnlyImages(node))
    return (
      <InGallery.Provider value={true}>
        <FeedGallery>{children}</FeedGallery>
      </InGallery.Provider>
    )
  // A `p` cannot hold the gallery's `div`, so a paragraph mixing text and images is a `div`.
  if (holdsImage(node)) return <div>{children}</div>
  return <p>{children}</p>
}

function Image({ src, alt }: { src?: string | Blob; alt?: string }) {
  const inGallery = useContext(InGallery)
  const source = typeof src === 'string' ? src : ''
  const image = <FeedImage key={source} source={source} alt={alt ?? ''} />
  return inGallery ? image : <FeedGallery>{image}</FeedGallery>
}

function Link({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <span>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-border underline-offset-4 hover:decoration-foreground"
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
  p: Paragraph,
  img: Image,
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
  pre: ({ node }) => <FeedCode {...fenceOf(node)} />,
  // `pre` draws fenced code itself, so every `code` reaching this is inline.
  code: ({ children }) => (
    <code className="rounded-md bg-muted px-1 font-mono type-code">{children}</code>
  ),
  hr: () => <hr className="border-border" />,
}

// An assistant's prose as Markdown (#1835). Raw HTML stays text, which is react-markdown's default.
export function FeedMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-4 break-words type-prose [overflow-wrap:anywhere]">
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        components={COMPONENTS}
        urlTransform={feedUrlTransform}
      >
        {text}
      </Markdown>
    </div>
  )
}
