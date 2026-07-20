import { cn } from '@/lib/utils'
import { Badge } from './badge'
import { GitBranchIcon, WarningIcon } from './icons'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

/** Where the session's checkout lives — the base tree, or a git worktree beside it. */
export type WorkspaceTree = 'main' | 'worktree'

/** The tree tag the chip wears, already resolved: the base tree, a worktree the branch
 * named (dir leaf == branch leaf), or an adopted worktree whose dir the tag must spell. */
export type WorkspaceTag =
  | { kind: 'main-tree' }
  | { kind: 'named-worktree'; dir: string }
  | { kind: 'adopted-worktree'; dir: string }

// The trailing path segment — a branch names its worktree, so `feat/auth-rotation` and
// `…/auth-rotation` are the same place. A trailing slash is not a segment.
function leaf(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1)
}

/** Which tree tag the chip shows. A worktree is `named` when its dir leaf equals the
 * branch leaf and `adopted` otherwise — the one case where the dir is spelled on screen. */
export function workspaceTag(tree: WorkspaceTree, branch: string, dir: string): WorkspaceTag {
  switch (tree) {
    case 'main':
      return { kind: 'main-tree' }
    case 'worktree':
      return leaf(dir) === leaf(branch)
        ? { kind: 'named-worktree', dir }
        : { kind: 'adopted-worktree', dir }
  }
}

/** The commits-vs-main line: `↑2 ↓1 vs main`, one arrow when only one side diverges, or
 * `= vs main` when level. The arrows are the compact ahead/behind notation, not glyphs
 * standing in for an icon. */
export function syncLabel(ahead: number, behind: number): string {
  const parts: string[] = []
  if (ahead) parts.push(`↑${ahead}`)
  if (behind) parts.push(`↓${behind}`)
  return `${parts.length > 0 ? parts.join(' ') : '='} vs main`
}

const TAG_TITLE: Record<WorkspaceTag['kind'], string | undefined> = {
  'main-tree': undefined,
  'named-worktree': 'worktree — named by the branch',
  'adopted-worktree': 'adopted worktree — dir does not match the branch',
}

// The dir inside the tag is a path, not a label — mono and left in its own case, against
// the badge's uppercased tag role.
function tagContent(tag: WorkspaceTag): React.ReactNode {
  switch (tag.kind) {
    case 'main-tree':
      return 'main tree'
    case 'named-worktree':
      return 'wt'
    case 'adopted-worktree':
      return (
        <>
          wt{' '}
          <Text variant="code-inline" className="normal-case">
            {tag.dir}
          </Text>
        </>
      )
  }
}

// Molecule: the ONE full home of "where is this session working". Branch is typed exactly
// once on screen — here — beside its tree tag, an uncommitted count, the sync line vs main,
// and a warning when another session shares the tree. PR surfaces echo only "→ main"; the
// rail row echoes only branch + tree. Everything arrives resolved: the chip decides nothing
// about the checkout, it only spells it.
export function WorkspaceIdentity({
  branch,
  tree,
  dir,
  dirty,
  ahead,
  behind,
  sharedCount,
  className,
}: {
  /** The session's branch — the ONE place it is written on the whole screen. */
  branch: string
  /** Whether the checkout is the base tree or a worktree beside it. */
  tree: WorkspaceTree
  /** The checkout directory. Its leaf decides whether a worktree reads as named or adopted. */
  dir: string
  /** Uncommitted files in the tree; the amber `n dirty` chip shows only when above zero. */
  dirty: number
  /** Commits ahead of main. */
  ahead: number
  /** Commits behind main. */
  behind: number
  /** Sessions resolving to this one tree; the shared-tree warning shows only when above one. */
  sharedCount: number
  className?: string
}): React.JSX.Element {
  const tag = workspaceTag(tree, branch, dir)
  const shared = sharedCount > 1
  return (
    <div
      className={cn(
        'inline-flex items-center gap-gap rounded-lg border border-inset-hair bg-inset px-2.5 py-0.5 text-muted-foreground',
        className,
      )}
    >
      <GitBranchIcon aria-hidden />
      <Text variant="code-inline" className="text-foreground-soft">
        {branch}
      </Text>
      <Badge title={TAG_TITLE[tag.kind]}>{tagContent(tag)}</Badge>
      {dirty > 0 && (
        <Text
          variant="meta"
          className="inline-flex items-center gap-tight text-tone-amber"
          title={`${dirty} uncommitted file${dirty > 1 ? 's' : ''}`}
        >
          {dirty} dirty
          <StatusDot tone="amber" />
        </Text>
      )}
      <Text variant="meta" className="text-foreground-faint" title="commits ahead/behind main">
        {syncLabel(ahead, behind)}
      </Text>
      {shared && (
        <Text
          variant="meta"
          className="inline-flex items-center gap-tight text-tone-amber"
          title="another session is working in this tree"
        >
          <WarningIcon aria-hidden />
          shared tree · {sharedCount} sessions
        </Text>
      )}
    </div>
  )
}
