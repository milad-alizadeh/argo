#!/usr/bin/env node
// PreToolUse(Edit|Write|NotebookEdit|Bash) guardrail: every agent change to this repo must run
// in a worktree. AGENTS.md forbids work in the shared main checkout; this enforces it
// mechanically.
//
// Two things it once let through, and no longer does (#1276):
//   - Scope. The guard watched apps/ and packages/ only, so a change to scripts/ or to a root
//     file such as package.json landed in the main checkout untouched.
//   - Tool. It watched Edit and Write only, so `cat > file <<EOF` through Bash — which is how
//     several harnesses are told to edit — walked straight past it.
// Both holes were found the same way: four files sat uncommitted in the main checkout with the
// guard installed and passing. The default scope is now the whole repository and Bash writes
// count as writes. A consumer narrows it in hooks.json (`worktreeGuard.roots`).
//
// Gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT injected for markerless
// harnesses like Codex) so it never touches the human's own workflow.
// decide() is pure path and string logic (no fs) and unit-tested in worktree-guard.test.mjs;
// resolveRoots() below is the only part that reads the disk. The stdin/stdout plumbing is
// shared with the other guards in hook-io.mjs. Naming a worktree: worktree-name-guard.mjs.
// Env-neutral by design: the project root comes from CLAUDE_PROJECT_DIR when
// present, else `git rev-parse --show-toplevel`, so the projection registers this
// same script under Codex without a rewrite.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runGuard, underAgent } from './hook-io.mjs'
import { CURRENT_DIRECTORY, writeTargets } from './shell-writes.mjs'

const WORKTREE_SEGMENT = `${path.sep}.claude${path.sep}worktrees${path.sep}`
// `.` is the whole repository — Argo's own scope, because "all of it except X" is how the last
// hole got in. A consumer whose agents must still edit part of the main checkout overrides it
// in hooks.json (`"worktreeGuard": { "roots": ["src", "lib"] }`).
const GUARDED_ROOTS = ['.']
const WHOLE_REPO = '.'

const ALLOW = { block: false }

/** A token the guard cannot resolve — guessing at an expansion would deny correct work. */
const unexpanded = (token) => token.includes('$') || token.includes('`')

function refuse(what, roots) {
  const scope = roots.includes(WHOLE_REPO)
    ? 'Every file in this repository is guarded — there is no unguarded corner left'
    : `This guards ${roots.map((root) => `${root}/`).join(' and ')}`
  return {
    block: true,
    reason:
      `${what} Changes must be made in a git worktree, not the shared main checkout. ` +
      `Enter one first (Claude Code: the EnterWorktree tool; other harnesses: ` +
      `git worktree add -b argo/<slug> .claude/worktrees/ticket-<slug>) and work on a ticket ` +
      `branch there. ${scope}. Naming, resuming, and recovery: docs/agents/worktrees.md.`,
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

function checkBash({ command, cwd, root, roots }) {
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
    return refuse(what, roots)
  }
  return ALLOW
}

/**
 * @param {{ toolName?: string, filePath?: string, command?: string, cwd?: string,
 *   projectDir?: string, isAgent?: boolean, roots?: string[] }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({
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
    return checkBash({ command, cwd: base, root, roots })
  }
  if (!filePath) return ALLOW
  const abs = path.resolve(base, filePath)
  if (!guarded({ abs, root, roots })) return ALLOW
  return refuse(`"${relative(abs, root)}" is in the main checkout.`, roots)
}

// Read the guarded roots from the descriptor that travels with the hook, so a consumer
// re-scopes the guard where they configure everything else about it.
function resolveRoots(root) {
  const descriptor = path.join(root, 'hooks.json')
  if (!existsSync(descriptor)) return GUARDED_ROOTS
  try {
    const { worktreeGuard } = JSON.parse(readFileSync(descriptor, 'utf8'))
    const roots = worktreeGuard?.roots
    return Array.isArray(roots) && roots.length ? roots : GUARDED_ROOTS
  } catch {
    return GUARDED_ROOTS
  }
}

function resolveProjectDir(cwd) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
    }).trim()
  } catch {
    return cwd
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runGuard((payload) => {
    const cwd = payload.cwd || process.cwd()
    const projectDir = resolveProjectDir(cwd)
    // Claude sends tool_input/tool_name; Codex sends toolInput/toolName (camelCase).
    const toolInput = payload.tool_input ?? payload.toolInput ?? {}
    return decide({
      toolName: payload.tool_name ?? payload.toolName,
      filePath: toolInput.file_path ?? toolInput.notebook_path,
      command: toolInput.command,
      cwd,
      projectDir,
      isAgent: underAgent(),
      roots: resolveRoots(projectDir),
    })
  })
}
