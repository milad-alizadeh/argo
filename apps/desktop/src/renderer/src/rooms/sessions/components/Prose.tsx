import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import { Text, type TextElement, type TextVariant } from '@/shared/components/ui'
import { PROSE_SUBSET } from './proseSubset'

// Line breaks are kept: markdown reads a lone newline as a space, but the line an agent broke is
// part of a verbatim fact, and it is what makes a literalised fence read as the block it was.
const WRAP = 'whitespace-pre-wrap break-words'

// `target="_blank"` is load-bearing: it routes the click through main's window-open handler
// (`shell.openExternal`, then deny) rather than navigating the cockpit away from itself.
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:']

const browsableHref = (href: string | undefined): string | undefined => {
  if (href === undefined) return undefined
  try {
    return SAFE_SCHEMES.includes(new URL(href).protocol) ? href : undefined
  } catch {
    return undefined
  }
}

/** A link the feed will follow, or the same words inert when its destination is not one this app
 * will open — a `javascript:` or `file:` destination loses its href rather than its text. */
function ProseLink({
  href,
  children,
}: {
  href: string | undefined
  children: React.ReactNode
}): React.JSX.Element {
  const browsable = browsableHref(href)
  if (browsable === undefined) return <Text variant="prose">{children}</Text>
  return (
    <a href={browsable} target="_blank" rel="noreferrer noopener">
      <Text variant="prose" className="text-primary-soft underline underline-offset-2">
        {children}
      </Text>
    </a>
  )
}

/** A fenced block, read off the parsed node rather than off the rendered children: the fence's
 * language and its text both live there, and taking them from one place is what keeps an unlabelled
 * fence a block rather than a long inline span. */
function ProseCodeBlock({ node }: { node: ExtraProps['node'] }): React.JSX.Element {
  const code = node?.children.find((child) => child.type === 'element')
  const text = code?.children.find((child) => child.type === 'text')?.value ?? ''
  const classes = code?.properties.className
  const language = (Array.isArray(classes) ? String(classes[0] ?? '') : '').replace('language-', '')
  return (
    <div className="flex flex-col gap-tight rounded-md inset-card p-inset">
      {language !== '' && (
        <Text variant="tag" className="text-foreground-faint">
          {language}
        </Text>
      )}
      <pre className="overflow-x-auto">
        <Text as="code" variant="prose" className="font-mono text-foreground-soft">
          {text}
        </Text>
      </pre>
    </div>
  )
}

/** One heading level. The ELEMENT is the level the agent wrote (the outline is its claim, not
 * ours); the type role is the rung that level reads at, which stops at three because a feed row is
 * not a document and an `h6` set smaller than its own body text reads as a caption. */
function heading(as: TextElement, variant: TextVariant): Components['h1'] {
  return ({ children }) => (
    <Text as={as} variant={variant} className={`${WRAP} font-semibold text-foreground`}>
      {children}
    </Text>
  )
}

// Every element the subset can produce, all on the ONE `prose` rung — headings excepted, which are
// the one thing in a run of prose whose whole job is to be a different size from it. Code is mono at the same size
// rather than at the `code` roles' — those are sized for a terminal and a diff, and spending one
// mid-sentence steps the body type mid-line. What quiets a row is its colour, never its size.
const ELEMENTS: Components = {
  h1: heading('h1', 'title'),
  h2: heading('h2', 'title'),
  h3: heading('h3', 'row-strong'),
  h4: heading('h3', 'row-strong'),
  h5: heading('h3', 'row-strong'),
  h6: heading('h3', 'row-strong'),
  p: ({ children }) => (
    <Text as="p" variant="prose" className={WRAP}>
      {children}
    </Text>
  ),
  strong: ({ children }) => (
    <Text as="strong" variant="prose" className="font-semibold text-foreground">
      {children}
    </Text>
  ),
  em: ({ children }) => (
    <Text as="em" variant="prose" className="italic">
      {children}
    </Text>
  ),
  a: ({ href, children }) => <ProseLink href={href}>{children}</ProseLink>,
  code: ({ children }) => (
    <Text
      as="code"
      variant="prose"
      className="rounded-hair bg-foreground/6 px-hair font-mono text-foreground"
    >
      {children}
    </Text>
  ),
  pre: ({ node }) => <ProseCodeBlock node={node} />,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-tight pl-nest">{children}</ul>,
  ol: ({ children }) => (
    <ol className="flex list-decimal flex-col gap-tight pl-nest">{children}</ol>
  ),
  li: ({ children }) => (
    <Text as="li" variant="prose" className={WRAP}>
      {children}
    </Text>
  ),
}

/**
 * Molecule: one run of agent prose, read as markdown rather than as characters.
 *
 * An identifier lands as code, a list lands as a list and a heading lands as a heading, so a
 * sentence about `#list` and `.railrest` is legible as the names it is about. Syntax the subset
 * excludes — a table, a remote image — shows the characters the agent wrote instead, which is the
 * honest reading of a verbatim tier: never dropped, never guessed at, never markup.
 */
export function Prose({
  markdown,
}: {
  /** The prose, verbatim as the record carried it. */
  markdown: string
}): React.JSX.Element {
  return (
    <div data-component="Prose" className="flex min-w-0 flex-col gap-gap">
      <Markdown remarkPlugins={PROSE_SUBSET} components={ELEMENTS}>
        {markdown}
      </Markdown>
    </div>
  )
}
