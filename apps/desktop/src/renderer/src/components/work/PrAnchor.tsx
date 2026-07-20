import { ArrowRightIcon, ArrowSquareOutIcon, Button, Text } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface PrAnchorProps {
  /** The pull request's number — its home is this anchor; every other ship-flow surface
   * that needs it only points back here (R9). */
  prNum: number
  /** Where "GitHub" opens. */
  ghUrl: string
  className?: string
}

/**
 * Molecule: the ribbon strip's trailing anchor to the pull request it ships through.
 *
 * Exists only once a PR does (R9) — nothing renders this before `Create PR` has run. The
 * base branch always reads "main"; the session's own branch is typed exactly once, in
 * `WorkspaceIdentity`.
 */
export function PrAnchor({ prNum, ghUrl, className }: PrAnchorProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'ml-auto inline-flex shrink-0 items-center gap-gap border-l border-inset-hair px-inset text-meta text-muted-foreground',
        className,
      )}
    >
      <Text variant="code-inline" className="text-foreground-soft">
        PR #{prNum}
      </Text>
      <ArrowRightIcon aria-hidden />
      <Text variant="code-inline">main</Text>
      <Button asChild variant="ghost" size="sm">
        <a href={ghUrl} target="_blank" rel="noreferrer">
          GitHub
          <ArrowSquareOutIcon aria-hidden />
        </a>
      </Button>
    </div>
  )
}
