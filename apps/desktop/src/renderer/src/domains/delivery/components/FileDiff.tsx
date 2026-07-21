import { useId } from 'react'
import { useDisclosure } from '@/hooks'
import { cn } from '@/lib/utils'
import {
  ArrowsLeftRightIcon,
  Badge,
  Checkbox,
  FileMinusIcon,
  FilePlusIcon,
  FileTextIcon,
  FlagIcon,
  type IconAtom,
  Text,
} from '@/shared/components/ui'
import type { DiffFinding, DiffHunkLine, FileChangeKind } from './diffModel'
import { FindingCard } from './FindingCard'

function kindGlyph(kind: FileChangeKind): { Icon: IconAtom; label: string } {
  switch (kind) {
    case 'M':
      return { Icon: FileTextIcon, label: 'modified' }
    case 'A':
      return { Icon: FilePlusIcon, label: 'added' }
    case 'D':
      return { Icon: FileMinusIcon, label: 'deleted' }
    case 'R':
      return { Icon: ArrowsLeftRightIcon, label: 'renamed' }
  }
}

function hunkLineTone(side: DiffHunkLine['side']): string {
  switch (side) {
    case 'add':
      return 'text-signal-ok'
    case 'del':
      return 'text-signal-bad'
    case 'context':
      return 'text-foreground-faint'
  }
}

/**
 * Molecule: one file's diff — header (kind, path, diffstat, Viewed) + hunk + any review
 * findings inline underneath it (R14: bodies live here, the Review tab only jumps to them).
 *
 * `viewed` is local to the file, via `useDisclosure`: marking it collapses the hunk and its
 * findings and dims the row. The header and the Viewed checkbox are siblings, not nested —
 * clicking either toggles the same state, and neither has to swallow the other's click.
 */
export function FileDiff({
  kind,
  path,
  adds,
  dels,
  hunk,
  findings,
  markUncommitted = false,
  defaultViewed = false,
  onAdvanceFindingState,
}: {
  /** Modified, added, deleted or renamed. */
  kind: FileChangeKind
  /** The file's repo-relative path. */
  path: string
  /** Lines added, from a file snapshot (provenance lives in the header's `title`). */
  adds: number
  /** Lines removed, same snapshot. */
  dels: number
  /** The hunk this file's change is rendered as. */
  hunk: DiffHunkLine[]
  /** Review findings anchored to this file, rendered inline under the hunk. */
  findings: DiffFinding[]
  /** Show the "uncommitted" badge — the caller decides: the All-files view marks a dirty
   * file, the By-commit view's own WIP group header already says so. */
  markUncommitted?: boolean
  /** Whether this file starts marked Viewed. */
  defaultViewed?: boolean
  /** Advance one of this file's findings — Address → Mark fixed → Reopen. */
  onAdvanceFindingState: (id: string) => void
}): React.JSX.Element {
  const { isOpen: viewed, toggle: toggleViewed } = useDisclosure({ defaultOpen: defaultViewed })
  const viewedId = useId()
  const { Icon: KindIcon, label: kindLabel } = kindGlyph(kind)
  const openFindings = findings.filter((finding) => finding.state !== 'fixed')
  const flagCount = openFindings.length || findings.length

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-inset-hair bg-inset',
        viewed && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-gap border-inset-hair border-b px-inset py-gap">
        <button
          type="button"
          onClick={toggleViewed}
          className="flex min-w-0 flex-1 items-center gap-gap text-left"
        >
          <span title={kindLabel} className="inline-flex shrink-0 text-muted-foreground">
            <KindIcon aria-hidden />
          </span>
          <Text
            variant="code-inline"
            className={cn('text-foreground-soft', viewed && 'line-through')}
          >
            {path}
          </Text>
          {markUncommitted && (
            <Badge variant="warn" title="uncommitted — in the tree, not yet in a commit">
              uncommitted
            </Badge>
          )}
          {findings.length > 0 && (
            <span
              className="inline-flex items-center gap-tight text-verdict-block"
              title={`${findings.length} review finding${findings.length > 1 ? 's' : ''} on this file`}
            >
              <FlagIcon aria-hidden />
              <Text variant="meta">{flagCount}</Text>
            </span>
          )}
          <span className="grow" />
          <span title="line counts from a file snapshot">
            <Text variant="row" className="text-foreground-faint" as="span">
              +{adds}
            </Text>{' '}
            <Text variant="row" className="text-foreground-faint" as="span">
              −{dels}
            </Text>
          </span>
        </button>
        <label
          htmlFor={viewedId}
          className="flex shrink-0 items-center gap-tight text-foreground-faint"
        >
          <Checkbox id={viewedId} checked={viewed} onCheckedChange={toggleViewed} />
          <Text variant="meta">Viewed</Text>
        </label>
      </div>
      {!viewed && (
        <>
          <Text variant="code" as="div" className="whitespace-pre-wrap px-inset py-snug">
            {hunk.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a static ordered snapshot — the array position IS the line's identity.
              <span key={index} className={hunkLineTone(line.side)}>
                {line.text}
                {index < hunk.length - 1 ? '\n' : ''}
              </span>
            ))}
          </Text>
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              severity={finding.severity}
              state={finding.state}
              line={finding.line}
              body={finding.body}
              by={finding.by}
              onAdvanceState={() => onAdvanceFindingState(finding.id)}
            />
          ))}
        </>
      )}
    </div>
  )
}
