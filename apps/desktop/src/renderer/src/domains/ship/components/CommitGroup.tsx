import { useDisclosure } from '@/hooks'
import { Badge, CaretDownIcon, CaretRightIcon, Text } from '@/shared/components/ui'
import type { DiffFinding, DiffHunkLine, FileChangeKind } from './diffModel'
import { FileDiff } from './FileDiff'

/** One file as a CommitGroup renders it — the group already knows the commit (or that there
 * isn't one), so it supplies `FileDiff`'s `commit`-derived badge itself. */
export interface CommitGroupFile {
  kind: FileChangeKind
  path: string
  adds: number
  dels: number
  hunk: DiffHunkLine[]
  findings: DiffFinding[]
  defaultViewed?: boolean
}

/**
 * Molecule: one commit's files, under a sha+message header — or, for the WIP group, an amber
 * "Uncommitted changes" header. The By-commit view of the Changes tab.
 *
 * Collapse is local (`useDisclosure`), open by default: nothing outside needs to know which
 * groups are expanded.
 */
export function CommitGroup({
  commit,
  files,
  onAdvanceFindingState,
}: {
  /** The commit this group belongs to, or `null` for the uncommitted-changes group. */
  commit: { sha: string; message: string } | null
  /** The files this commit (or the WIP tree) touched. */
  files: CommitGroupFile[]
  /** Advance a finding on one of this group's files. */
  onAdvanceFindingState: (id: string) => void
}): React.JSX.Element {
  const { isOpen: expanded, toggle: toggleExpanded } = useDisclosure({ defaultOpen: true })
  const CaretIcon = expanded ? CaretDownIcon : CaretRightIcon

  return (
    <div>
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex w-full items-center gap-gap py-gap"
      >
        <CaretIcon aria-hidden className="text-foreground-faint" />
        {commit === null ? (
          <Badge variant="warn">Uncommitted changes</Badge>
        ) : (
          <>
            <Text variant="code-inline" className="text-muted-foreground">
              {commit.sha}
            </Text>
            <Text variant="row-strong" className="text-foreground">
              {commit.message}
            </Text>
          </>
        )}
        <span className="grow" />
        <Text variant="meta" className="text-foreground-faint">
          {files.length} file{files.length > 1 ? 's' : ''}
        </Text>
      </button>
      {expanded &&
        files.map((file) => (
          <FileDiff key={file.path} {...file} onAdvanceFindingState={onAdvanceFindingState} />
        ))}
    </div>
  )
}
