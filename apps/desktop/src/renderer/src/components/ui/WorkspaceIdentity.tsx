import { cn } from '@/lib/utils'
import { Badge } from './badge'
import { GitBranchIcon, WarningIcon } from './icons'
import { StatusDot } from './StatusDot'
import { Text } from './Text'

/** Where the session's checkout lives — the base tree, or a git worktree beside it. */
export type WorkspaceTree = 'main' | 'worktree'

/** The tree tag the chip wears, already resolved: the base tree, a worktree the branch
 * named (directory leaf == branch leaf), or an adopted worktree whose directory the tag
 * must spell. */
export type WorkspaceTag =
  | { kind: 'main-tree' }
  | { kind: 'named-worktree'; directory: string }
  | { kind: 'adopted-worktree'; directory: string }

// The trailing path segment — a branch names its worktree, so `feat/auth-rotation` and
// `…/auth-rotation` are the same place. A trailing slash is not a segment.
function leaf(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed.slice(trimmed.lastIndexOf('/') + 1)
}

/** Which tree tag the chip shows. A worktree is `named` when its directory leaf equals the
 * branch leaf and `adopted` otherwise — the one case where the directory is spelled on
 * screen. */
export function workspaceTag(tree: WorkspaceTree, branch: string, directory: string): WorkspaceTag {
  switch (tree) {
    case 'main':
      return { kind: 'main-tree' }
    case 'worktree':
      return leaf(directory) === leaf(branch)
        ? { kind: 'named-worktree', directory }
        : { kind: 'adopted-worktree', directory }
  }
}

/** The commits-vs-main line: `↑2 ↓1 vs main`, one arrow when only one side diverges, or
 * `= vs main` when level. */
export function syncLabel(ahead: number, behind: number): string {
  const parts: string[] = []
  if (ahead > 0) parts.push(`↑${ahead}`)
  if (behind > 0) parts.push(`↓${behind}`)
  return `${parts.length > 0 ? parts.join(' ') : '='} vs main`
}

function tagTitle(tag: WorkspaceTag): string | undefined {
  switch (tag.kind) {
    case 'main-tree':
      return undefined
    case 'named-worktree':
      return `worktree ${tag.directory} — named by the branch`
    case 'adopted-worktree':
      return 'adopted worktree — directory does not match the branch'
  }
}

function tagContent(tag: WorkspaceTag): React.ReactNode {
  switch (tag.kind) {
    case 'main-tree':
      return 'main tree'
    case 'named-worktree':
      return 'worktree'
    case 'adopted-worktree':
      // Only the family changes: the path keeps the tag role's size and leading, so a
      // spelled directory cannot grow the badge past its siblings.
      return (
        <>
          worktree <span className="font-mono normal-case">{tag.directory}</span>
        </>
      )
  }
}

/**
 * The ONE full home of "where is this session working". Branch is typed exactly once on
 * screen — here — beside its tree tag, an uncommitted count, the sync line vs main, and a
 * warning when another session shares the tree. Everything arrives resolved: the chip decides
 * nothing about the checkout, it only spells it.
 */
export function WorkspaceIdentity({
  branch,
  tree,
  directory,
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
  directory: string
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
  const tag = workspaceTag(tree, branch, directory)
  const shared = sharedCount > 1
  return (
    // The chip declares the `meta` role so its 1em icons resolve against 10px here rather
    // than whatever encloses it.
    <div
      className={cn(
        'inline-flex items-center gap-gap rounded-lg border border-inset-hair bg-inset px-2.5 py-hair text-meta text-muted-foreground',
        className,
      )}
    >
      <GitBranchIcon aria-hidden />
      <Text variant="code-inline" className="text-foreground-soft">
        {branch}
      </Text>
      <Badge title={tagTitle(tag)}>{tagContent(tag)}</Badge>
      {dirty > 0 && (
        <Text
          variant="meta"
          className="inline-flex items-center gap-tight text-tone-amber"
          title={`${dirty} uncommitted file${dirty > 1 ? 's' : ''}`}
        >
          {dirty} dirty
          <StatusDot tone="amber" className="size-snug" />
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
