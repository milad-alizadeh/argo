import { useMemo } from 'react'
import Markdown, { type Components, type ExtraProps } from 'react-markdown'
import { Text, type TextVariant } from '@/shared/components/ui'
import { PROSE_SUBSET } from './proseSubset'

// Agent prose, read as the small markdown subset `proseSubset` admits. Nothing here is
// dangerouslySet and no HTML string is ever assembled: react-markdown builds React elements, so a
// transcript string reaches the screen as a text node whatever it contains.

const WRAP = 'whitespace-pre-wrap break-words'

// A link opens in the browser rather than in the window. `target="_blank"` is what routes it
// through main's window-open handler (`shell.openExternal`, then deny), so the cockpit cannot be
// navigated away from itself by something an agent typed.
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
  variant,
  children,
}: {
  href: string | undefined
  variant: TextVariant
  children: React.ReactNode
}): React.JSX.Element {
  const browsable = browsableHref(href)
  if (browsable === undefined) return <Text variant={variant}>{children}</Text>
  return (
    <a href={browsable} target="_blank" rel="noreferrer noopener">
      <Text variant={variant} className="text-primary-soft underline underline-offset-2">
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
        <Text as="code" variant="code" className="text-foreground-soft">
          {text}
        </Text>
      </pre>
    </div>
  )
}

// Every element the subset can produce, mapped to the type ladder. Written as a function of the
// row's own variant so a thought reads at `meta` and a message at `prose` without the two rows
// keeping separate maps.
const elementsAt = (variant: TextVariant): Components => ({
  p: ({ children }) => (
    <Text as="p" variant={variant} className={WRAP}>
      {children}
    </Text>
  ),
  strong: ({ children }) => (
    <Text as="strong" variant={variant} className="font-semibold text-foreground">
      {children}
    </Text>
  ),
  em: ({ children }) => (
    <Text as="em" variant={variant} className="italic">
      {children}
    </Text>
  ),
  a: ({ href, children }) => (
    <ProseLink href={href} variant={variant}>
      {children}
    </ProseLink>
  ),
  code: ({ children }) => (
    <Text variant="code-inline" className="rounded-hair bg-foreground/8 px-hair text-foreground">
      {children}
    </Text>
  ),
  pre: ({ node }) => <ProseCodeBlock node={node} />,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-tight pl-nest">{children}</ul>,
  ol: ({ children }) => (
    <ol className="flex list-decimal flex-col gap-tight pl-nest">{children}</ol>
  ),
  li: ({ children }) => (
    <Text as="li" variant={variant} className={WRAP}>
      {children}
    </Text>
  ),
})

/**
 * Molecule: one run of agent prose, read as markdown rather than as characters.
 *
 * An identifier lands as code and a list lands as a list, so a sentence about `#list` and
 * `.railrest` is legible as the names it is about. Syntax the subset excludes — a heading, a table,
 * a remote image — shows the characters the agent wrote instead, which is the honest reading of a
 * verbatim tier: never dropped, never guessed at, never markup.
 */
export function Prose({
  markdown,
  variant,
}: {
  /** The prose, verbatim as the record carried it. */
  markdown: string
  /** Which rung of the type ladder this run reads at — a message speaks, a thought murmurs. */
  variant: TextVariant
}): React.JSX.Element {
  // Held across renders: a fresh component map is a fresh identity for every element in the run,
  // and the feed re-renders on every transcript tick with dozens of these rows mounted.
  const elements = useMemo(() => elementsAt(variant), [variant])
  return (
    <div data-component="Prose" className="flex min-w-0 flex-col gap-gap">
      <Markdown remarkPlugins={PROSE_SUBSET} components={elements}>
        {markdown}
      </Markdown>
    </div>
  )
}
