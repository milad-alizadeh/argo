// WHERE the work happens: every agent change to this repo must run in a worktree, never the
// shared main checkout — a write, and the commit that lands it. Split from worktree-guard.mts on
// file length alone; that file dispatches between this half and the naming half in
// worktree-names.mts. The convention itself: docs/agents/worktrees.md.
import path from 'node:path'
import type { Verdict } from './hook-io.mts'
import { ALLOW } from './hook-io.mts'
import { afterGitOptions, invocation, segments, tokenize, unexpanded } from './shell-commands.mts'
import { CURRENT_DIRECTORY, writeTargets } from './shell-writes.mts'

const WORKTREE_SEGMENT = `${path.sep}.claude${path.sep}worktrees${path.sep}`
// `.` is the whole repository — Argo's own scope, because "all of it except X" is how the last
// hole got in. A consumer whose agents must still edit part of the main checkout overrides it
// in hooks.json (`"worktreeGuard": { "roots": ["src", "lib"] }`).
export const GUARDED_ROOTS = ['.']
const WHOLE_REPO = '.'

function refuseEdit(what: string, roots: string[]): Verdict {
  const scope = roots.includes(WHOLE_REPO)
    ? 'Every file in this repository is guarded — there is no unguarded corner left'
    : `This guards ${roots.map((root) => `${root}/`).join(' and ')}`
  return {
    block: true,
    reason:
      `${what} Changes must be made in a git worktree, not the shared main checkout. ` +
      `Create one first — git worktree add -b argo/<slug> .claude/worktrees/ticket-<slug> — then ` +
      `enter it by path (Claude Code: EnterWorktree { path: ".claude/worktrees/ticket-<slug>" }; ` +
      `other harnesses: cd) and work on a ticket branch there. ${scope}. ` +
      `Naming, resuming, and recovery: docs/agents/worktrees.md.`,
  }
}

/** True when an absolute path is one this guard owns: inside the project, outside a worktree. */
function guarded({ abs, root, roots }: { abs: string; root: string; roots: string[] }): boolean {
  // A file already inside a worktree is isolated by definition.
  if (abs.includes(WORKTREE_SEGMENT)) return false
  const rel = path.relative(root, abs)
  // Outside the project tree entirely — not ours to guard. A scratchpad or /tmp lands here.
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false
  // The root itself: what an editor that names no path (apply_patch) resolves to.
  if (rel === '') return roots.includes(WHOLE_REPO)
  if (roots.includes(WHOLE_REPO)) return true
  return roots.includes(rel.split(path.sep)[0] ?? '')
}

const relative = (abs: string, root: string): string => path.relative(root, abs) || abs

/** What the two shell checks below both need: the command line and where it would run. */
type ShellCheck = { command: string; cwd: string; root: string; roots: string[] }

function checkBashWrites({ command, cwd, root, roots }: ShellCheck): Verdict {
  for (const target of writeTargets(command)) {
    // A token still holding a `$` or a backtick is one this hook cannot resolve; guessing at
    // the expansion would deny a write that may well be outside the repo.
    if (unexpanded(target)) continue
    const abs = path.resolve(cwd, target)
    if (!guarded({ abs, root, roots })) continue
    const what =
      target === CURRENT_DIRECTORY
        ? 'This command edits files, and the current directory is the main checkout.'
        : `This command writes "${relative(abs, root)}" in the main checkout.`
    return refuseEdit(what, roots)
  }
  return ALLOW
}

// The commit is the second way work lands in the shared checkout, and the write half above
// cannot see it: `git commit` names no file, so `writeTargets` returns nothing to judge. This
// ran as a husky `pre-commit` hook until #1911 removed husky, and it belongs here instead, for
// the reason the write half does: a `PreToolUse` hook is asked before the command runs, while a
// `pre-commit` hook is skipped by the `--no-verify` any session can pass. What it prevents is a
// commit onto whatever branch and index another session is using in the shared checkout.
//
// The override is an environment prefix, read off the command line the way `ARGO_SHIP=1` is, for
// the deliberate main-checkout commit the process does have: `skills-lock.json` after a reinstall.
const MAIN_COMMIT_MARKER = 'ARGO_MAIN_COMMIT=1'

function checkGitCommit({ command, cwd, root, roots }: ShellCheck): Verdict {
  if (!guarded({ abs: cwd, root, roots })) return ALLOW
  for (const segment of segments(command)) {
    const { prefix, name, args } = invocation(tokenize(segment))
    if (prefix.includes(MAIN_COMMIT_MARKER)) continue
    if (name !== 'git' || afterGitOptions(args)[0] !== 'commit') continue
    return {
      block: true,
      reason:
        `This commits from the shared main checkout, where it would land on whatever branch and ` +
        `index another session is using. Commit inside a worktree, on a ticket branch — ` +
        `git worktree add -b argo/#<N>-<slug> .claude/worktrees/ticket-<N>-<slug> — then enter ` +
        `it by path (Claude Code: EnterWorktree { path: ".claude/worktrees/ticket-<N>-<slug>" }; ` +
        `other harnesses: cd). For a deliberate main-checkout commit, such as skills-lock.json ` +
        `after a reinstall, prefix the command with ${MAIN_COMMIT_MARKER}. ` +
        `Naming, resuming, and recovery: docs/agents/worktrees.md.`,
    }
  }
  return ALLOW
}

/** WHERE: is this change being made outside a worktree? */
export function decideEdit({
  toolName,
  filePath,
  command,
  cwd,
  projectDir,
  isAgent,
  roots = GUARDED_ROOTS,
}: {
  toolName?: string | undefined
  filePath?: string | undefined
  command?: string | undefined
  cwd?: string | undefined
  projectDir?: string | undefined
  isAgent?: boolean | undefined
  roots?: string[]
}): Verdict {
  if (!isAgent) return ALLOW // human workflow — never guarded
  const base = cwd || process.cwd()
  const root = projectDir || base

  if (typeof command === 'string' && (!toolName || toolName === 'Bash')) {
    const committing = checkGitCommit({ command, cwd: base, root, roots })
    if (committing.block) return committing
    return checkBashWrites({ command, cwd: base, root, roots })
  }
  if (!filePath) return ALLOW
  const abs = path.resolve(base, filePath)
  if (!guarded({ abs, root, roots })) return ALLOW
  return refuseEdit(`"${relative(abs, root)}" is in the main checkout.`, roots)
}
