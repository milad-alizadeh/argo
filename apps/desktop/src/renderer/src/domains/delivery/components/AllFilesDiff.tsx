import { SectionHeader, Text } from '@/shared/components/ui'
import type { DiffFinding, DiffHunkLine, FileChangeKind } from './diffModel'
import { FileDiff } from './FileDiff'

/** One file as the flat All-files view renders it — `commit` is the sha it landed in, or
 * `null` for a file still only in the working tree. */
export interface AllFilesDiffFile {
  kind: FileChangeKind
  path: string
  adds: number
  dels: number
  hunk: DiffHunkLine[]
  findings: DiffFinding[]
  commit: string | null
  defaultViewed?: boolean
}

/**
 * Organism: ONE flat cumulative diff vs merge-base — net effect, not per-commit
 * concatenation. The Changes tab's default view; `CommitGroup` renders its By-commit sibling.
 */
export function AllFilesDiff({
  files,
  onAdvanceFindingState,
}: {
  /** Every changed file, dirty ones marked. */
  files: AllFilesDiffFile[]
  /** Advance a finding on one of these files. */
  onAdvanceFindingState: (id: string) => void
}): React.JSX.Element {
  const adds = files.reduce((total, file) => total + file.adds, 0)
  const dels = files.reduce((total, file) => total + file.dels, 0)

  return (
    <div>
      <SectionHeader
        className="mb-gap px-tight"
        label="vs merge-base"
        count={`+${adds} −${dels} · uncommitted included`}
      />
      {files.length === 0 ? (
        <Text variant="row" className="text-muted-foreground">
          No changes yet.
        </Text>
      ) : (
        files.map(({ commit, ...file }) => (
          <FileDiff
            key={file.path}
            {...file}
            markUncommitted={commit === null}
            onAdvanceFindingState={onAdvanceFindingState}
          />
        ))
      )}
    </div>
  )
}
