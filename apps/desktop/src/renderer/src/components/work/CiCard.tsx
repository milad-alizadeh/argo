import { cn } from '@/lib/utils'

export interface CiCardProps {
  /** The header's leading content — composed `Text`, naming what the card is keyed to
   * ("CI · GitHub Actions · a1b2c3d", "Lint · Argo · this tree"). PrChecksList and
   * CheckOutput each word their own keyed-to fact, so the shell takes it as a node rather
   * than a `sha`/`command` field of its own. */
  heading: React.ReactNode
  /** The header's trailing content, pushed flush right — the CI aggregate rollup, or a
   * check's command. Omitted when the header has nothing to add on that side. */
  trailing?: React.ReactNode
  /** The card's body — run rows, or a captured feed. */
  children: React.ReactNode
  className?: string
}

/**
 * Molecule: the bordered card shell PrChecksList and CheckOutput both wear (the study's
 * `.ci`) — a header row naming what the card is keyed to, and a body slot beneath it.
 */
export function CiCard({ heading, trailing, children, className }: CiCardProps): React.JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-inset-hair bg-inset', className)}>
      <div className="flex items-center gap-snug border-inset-hair border-b px-inset py-snug">
        {heading}
        {trailing !== undefined && <div className="ml-auto shrink-0">{trailing}</div>}
      </div>
      {children}
    </div>
  )
}
