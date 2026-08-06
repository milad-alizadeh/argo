import type { IconAtom } from '@/shared/components/ui'
import { Text } from '@/shared/components/ui'

/**
 * Molecule: one of Welcome's three lines about what Argo does.
 *
 * Plain language and no jargon (#165): the first screen teaches the product, not the
 * vocabulary. It asks for nothing, so it carries no control of its own.
 */
export function BenefitRow({
  icon: Icon,
  title,
  detail,
}: {
  /** The glyph that opens the line. Decorative: the title already says it. */
  icon: IconAtom
  /** What you get, in four or five words. */
  title: string
  /** The same thing again, once, with enough detail to be believed. */
  detail: string
}): React.JSX.Element {
  return (
    <div data-component="BenefitRow" className="flex items-start gap-inset">
      <Icon aria-hidden className="icon-mark shrink-0 text-primary" />
      <div className="flex min-w-0 flex-col gap-tight">
        <Text variant="row-strong" as="h3" className="text-foreground-bright">
          {title}
        </Text>
        <Text variant="meta" as="p" className="text-foreground-soft">
          {detail}
        </Text>
      </div>
    </div>
  )
}
