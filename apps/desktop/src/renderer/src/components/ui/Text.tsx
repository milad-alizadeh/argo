import { cn, type TypeRole } from '@/lib/utils'

export type TextVariant = TypeRole

export const TEXT_ELEMENTS = ['span', 'p', 'div', 'h1', 'h2', 'h3', 'code', 'header'] as const

export type TextElement = (typeof TEXT_ELEMENTS)[number]

// The ONE place a `text-<role>` class is spelled. Written out per role rather than built
// as `text-${variant}` so Tailwind's scanner still sees each class literally; the Record
// makes a role added to TYPE_ROLES and forgotten here a compile error.
export const TYPE_ROLE_CLASS: Record<TextVariant, string> = {
  headline: 'text-headline',
  title: 'text-title',
  row: 'text-row',
  'row-strong': 'text-row-strong',
  prose: 'text-prose',
  meta: 'text-meta',
  tag: 'text-tag',
  eyebrow: 'text-eyebrow',
  code: 'text-code',
  'code-inline': 'text-code-inline',
}

// A type role is visual, so the document outline never follows from it — picking `h1`
// because a role is big is the classic bug. Code is the one exception: that role means
// "this is code", which is exactly what `<code>` means.
function defaultElement(variant: TextVariant): TextElement {
  switch (variant) {
    case 'code':
    case 'code-inline':
      return 'code'
    default:
      return 'span'
  }
}

type TextProps = React.HTMLAttributes<HTMLElement> & {
  /** Which rung of the closed type ladder to set. This is the only way type is applied
   * — a raw `text-<role>` class at a call site is a violation. */
  variant: TextVariant
  /** The element to render. Defaults to `span` (`code` for the two code roles), because
   * heading level and paragraph structure are the call site's decision, not the role's. */
  as?: TextElement
  /** The rendered element, for a caller that has to move focus onto it. */
  ref?: React.Ref<HTMLElement>
}

/**
 * Atom: the ONE way type reaches the screen.
 *
 * Colour is deliberately not part of a role, so there is no `tone` prop — a caller passes
 * a colour class through `className` and `cn()` de-dupes role against role without eating
 * it.
 */
export function Text({ variant, as, className, ...rest }: TextProps): React.JSX.Element {
  // JSX intersects the props of every member of the element union, so no single `ref` type
  // satisfies all of them. Widening here keeps the closed union in the PUBLIC prop type.
  const Element = (as ?? defaultElement(variant)) as React.ElementType
  return <Element className={cn(TYPE_ROLE_CLASS[variant], className)} {...rest} />
}
