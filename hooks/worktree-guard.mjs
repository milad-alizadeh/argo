#!/usr/bin/env node
// PreToolUse(Edit|Write|NotebookEdit|Bash|EnterWorktree) guardrail: the worktree discipline, whole.
//
// One hook, two moments, because they are one rule read from two ends and a session that trips
// the first usually trips the second in its next call:
//
//   - WHERE the work happens. Every agent change to this repo must run in a worktree, never the
//     shared main checkout — a write, and the commit that lands it. `decideEdit()` below.
//   - WHICH worktree it is. A tree is named at creation, the one moment the name is still free
//     to change. `decideName()`, in worktree-names.mjs, which this file imports.
//
// They were two hooks and two `hooks.json` entries until they were merged, which is why the two
// decisions stay two pure functions rather than one: they answer different questions and share
// only the plumbing. The naming half sits in its own file for length alone, and is not a second
// hook: there is one entry, on the union of the two old matchers, and one command the projection
// invokes. The dispatcher is `decide()`, and it asks the naming question first, because a badly
// named `git worktree add` is the more actionable complaint of the two when both would fire.
//
// Two things the WHERE half once let through, and no longer does (#1276):
//   - Scope. It watched apps/ and packages/ only, so a change to a root file such as
//     package.json landed in the main checkout untouched.
//   - Tool. It watched Edit and Write only, so `cat > file <<EOF` through Bash — which is how
//     several harnesses are told to edit — walked straight past it.
// Both holes were found the same way: four files sat uncommitted in the main checkout with the
// guard installed and passing. The default scope is now the whole repository and Bash writes
// count as writes. A consumer narrows it in hooks.json (`worktreeGuard.roots`).
//
// The WHICH half never fires on an edit inside an existing tree, so trees named before it drain
// rather than break (#901). `EnterWorktree` cannot reach the convention by any input, so only
// its `path:` passes (#1684).
//
// Gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT injected for markerless harnesses
// like Codex) so it never touches the human's own workflow. Both decide() functions are pure
// path and string logic (no fs, no git); resolveRoots() is the only part that reads the disk.
// The stdin/stdout plumbing is shared with the other hooks in hook-io.mjs. Env-neutral by
// design: the project root comes from CLAUDE_PROJECT_DIR when present, else the git toplevel, so
// the projection registers this same script under Codex without a rewrite.
// The convention and what parses it: docs/agents/worktrees.md.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALLOW,
  readWorktreeGuard,
  resolveProjectDir,
  runGuard,
  toolCall,
  underAgent,
} from './hook-io.mjs'
import { afterGitOptions, invocation, segments, tokenize, unexpanded } from './shell-commands.mjs'
import { CURRENT_DIRECTORY, writeTargets } from './shell-writes.mjs'
import { configureNaming, decideName } from './worktree-names.mjs'

// ---------------------------------------------------------------------------------------------
// WHERE: every agent change runs in a worktree.
// ---------------------------------------------------------------------------------------------

const WORKTREE_SEGMENT = `${path.sep}.claude${path.sep}worktrees${path.sep}`
// `.` is the whole repository — Argo's own scope, because "all of it except X" is how the last
// hole got in. A consumer whose agents must still edit part of the main checkout overrides it
// in hooks.json (`"worktreeGuard": { "roots": ["src", "lib"] }`).
const GUARDED_ROOTS = ['.']
const WHOLE_REPO = '.'

function refuseEdit(what, roots) {
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
function guarded({ abs, root, roots }) {
  // A file already inside a worktree is isolated by definition.
  if (abs.includes(WORKTREE_SEGMENT)) return false
  const rel = path.relative(root, abs)
  // Outside the project tree entirely — not ours to guard. A scratchpad or /tmp lands here.
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false
  // The root itself: what an editor that names no path (apply_patch) resolves to.
  if (rel === '') return roots.includes(WHOLE_REPO)
  if (roots.includes(WHOLE_REPO)) return true
  return roots.includes(rel.split(path.sep)[0])
}

const relative = (abs, root) => path.relative(root, abs) || abs

function checkBashWrites({ command, cwd, root, roots }) {
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

function checkGitCommit({ command, cwd, root, roots }) {
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

/**
 * WHERE: is this change being made outside a worktree?
 * @param {{ toolName?: string, filePath?: string, command?: string, cwd?: string,
 *   projectDir?: string, isAgent?: boolean, roots?: string[] }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decideEdit({
  toolName,
  filePath,
  command,
  cwd,
  projectDir,
  isAgent,
  roots = GUARDED_ROOTS,
}) {
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

// ---------------------------------------------------------------------------------------------
// The one hook.
// ---------------------------------------------------------------------------------------------

/**
 * The matcher is the union of what the two halves watch, and this dispatches between them, so
 * `EnterWorktree` keeps reaching the naming half and an `Edit` keeps reaching the edit half.
 * @param {{ toolName?: string, toolInput?: object, cwd?: string, projectDir?: string,
 *   isAgent?: boolean, roots?: string[] }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ toolName, toolInput = {}, cwd, projectDir, isAgent, roots }) {
  if (!isAgent) return ALLOW
  // Naming first: when a session creates a badly named tree from the main checkout, the name is
  // the thing it can still fix in the same call.
  const naming = decideName({ toolName, toolInput, cwd, isAgent })
  if (naming.block) return naming
  return decideEdit({
    toolName,
    filePath: toolInput.file_path ?? toolInput.notebook_path,
    command: toolInput.command,
    cwd,
    projectDir,
    isAgent,
    roots,
  })
}

function resolveRoots(config) {
  const roots = config?.roots
  return Array.isArray(roots) && roots.length ? roots : GUARDED_ROOTS
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGuard((payload) => {
    const cwd = payload.cwd || process.cwd()
    const projectDir = resolveProjectDir(cwd)
    // The naming convention is the project's, read from the same descriptor as the roots. A
    // project that configures no `branchPrefix` gets no branch-name judgement at all.
    const config = readWorktreeGuard(projectDir)
    configureNaming(config)
    return decide({
      ...toolCall(payload),
      cwd,
      projectDir,
      isAgent: underAgent(),
      roots: resolveRoots(config),
    })
  })
}
