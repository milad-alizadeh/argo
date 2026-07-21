import { Badge, Text } from '@/shared/components/ui'
import { CiCard } from './CiCard'

export const LOCAL_CHECKS = ['lint', 'types', 'tests'] as const

export type LocalCheck = (typeof LOCAL_CHECKS)[number]

const CHECK_LABEL: Record<LocalCheck, string> = {
  lint: 'Lint',
  types: 'Typecheck',
  tests: 'Tests',
}

export interface CheckOutputProps {
  check: LocalCheck
  /** The command Argo ran, in mono at the header's trailing edge. */
  command: string
  /** The captured feed, rendered as text — never markup. */
  output: string
  className?: string
}

/**
 * Molecule: one local check's captured output, keyed to the sha it ran against.
 *
 * Renders inside the Commits `NodeDrawer` (R11) — local checks are Argo's own, on this
 * tree, distinct from the remote-origin runs `PrChecksList` shows; both wear the shared
 * `CiCard` shell.
 */
export function CheckOutput({
  check,
  command,
  output,
  className,
}: CheckOutputProps): React.JSX.Element {
  return (
    <CiCard
      className={className}
      heading={
        <>
          <Text variant="tag" className="text-muted-foreground">
            {CHECK_LABEL[check]}
          </Text>
          <Badge>Argo · this tree</Badge>
        </>
      }
      trailing={
        <Text variant="code-inline" className="normal-case text-foreground-faint">
          {command}
        </Text>
      }
    >
      <Text
        as="div"
        variant="code"
        className="overflow-x-auto whitespace-pre-wrap px-inset py-snug text-foreground-soft"
      >
        {output}
      </Text>
    </CiCard>
  )
}
