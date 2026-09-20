#!/usr/bin/env node
// The worktree discipline at PreToolUse(Edit|Write|NotebookEdit|Bash|EnterWorktree) and
// PostToolUse(Bash): guard the location and name before creation, then carry installed skills.
//
// One hook script, three moments, because a tree is not ready until all three agree:
//
//   - WHERE the work happens. Every agent change to this repo must run in a worktree, never the
//     shared main checkout — a write, and the commit that lands it. `decideEdit()` below.
//   - WHICH worktree it is. A tree is named at creation, the one moment the name is still free
//     to change. `decideName()`, in worktree-names.mts, which this file imports.
//   - WHAT skills it sees. Git omits ignored installed skills from a linked checkout, so the
//     PostToolUse event copies the primary checkout's current bundle after creation.
//
// WHERE and WHICH were two hooks and two `hooks.json` entries until they were merged, so the two
// decisions stay two pure functions rather than one: they answer different questions and share
// only the plumbing. Each half sits in its own file for length alone (worktree-edit-guard.mts,
// worktree-names.mts). The dispatcher is `decide()`, and it asks the naming question first,
// because a badly named `git worktree add` is the more actionable complaint of the two when both
// would fire.
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
// Both event registrations are gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT injected
// for markerless harnesses
// like Codex) so it never touches the human's own workflow. Both decide() functions are pure
// path and string logic (no fs, no git); resolveRoots() is the only part that reads the disk.
// The stdin/stdout plumbing is shared with the other hooks in hook-io.mts. Env-neutral by
// design: the project root comes from CLAUDE_PROJECT_DIR when present, else the git toplevel, so
// the projection registers this same script under Codex without a rewrite.
// The convention and what parses it: docs/agents/worktrees.md.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Verdict, WorktreeGuardConfiguration } from './hook-io.mts'
import {
  ALLOW,
  readWorktreeGuard,
  resolveProjectDir,
  runGuard,
  toolCall,
  underAgent,
} from './hook-io.mts'
import { decideEdit, GUARDED_ROOTS } from './worktree-edit-guard.mts'
import { configureNaming, decideName } from './worktree-names.mts'
import { copySkillsAfterWorktreeAdd } from './worktree-skills.mts'

// ---------------------------------------------------------------------------------------------
// The one hook.
// ---------------------------------------------------------------------------------------------

/**
 * The matcher is the union of what the two halves watch, and this dispatches between them, so
 * `EnterWorktree` keeps reaching the naming half and an `Edit` keeps reaching the edit half.
 */
export function decide({
  toolName,
  toolInput = {},
  cwd,
  projectDir,
  isAgent,
  roots,
}: {
  toolName?: string | undefined
  toolInput?: Record<string, unknown>
  cwd?: string | undefined
  projectDir?: string | undefined
  isAgent?: boolean | undefined
  roots?: string[]
}): Verdict {
  if (!isAgent) return ALLOW
  // Naming first: when a session creates a badly named tree from the main checkout, the name is
  // the thing it can still fix in the same call.
  const naming = decideName({ toolName, toolInput, cwd, isAgent })
  if (naming.block) return naming
  return decideEdit({
    toolName,
    filePath: named(toolInput.file_path ?? toolInput.notebook_path),
    command: named(toolInput.command),
    cwd,
    projectDir,
    isAgent,
    roots,
  })
}

/** A tool input value, when the harness sent a string there. Anything else is not a path. */
const named = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

function resolveRoots(config: WorktreeGuardConfiguration): string[] {
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
    const isAgent = underAgent()
    if ((payload.hook_event_name ?? payload.hookEventName) === 'PostToolUse') {
      if (isAgent) copySkillsAfterWorktreeAdd({ ...toolCall(payload), cwd })
      return ALLOW
    }
    return decide({
      ...toolCall(payload),
      cwd,
      projectDir,
      isAgent,
      roots: resolveRoots(config),
    })
  })
}
