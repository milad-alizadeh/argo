#!/usr/bin/env node
// PreToolUse(Edit|Write) guardrail: implementation edits must run in a worktree.
// AGENTS.md forbids ticket builds in the shared main checkout; this enforces it
// mechanically for agents. Scoped to apps/ and packages/ so doc/memory/config
// fixes in the main checkout (which AGENTS.md explicitly allows) still pass.
// Gated on an agent marker (CLAUDECODE, or ARGO_HOOK_AGENT injected for markerless
// harnesses like Codex) so it never touches the human's own workflow.
// Pure path logic (no fs) — decide() is unit-tested in worktree-guard.test.mjs.
// Env-neutral by design: the project root comes from CLAUDE_PROJECT_DIR when
// present, else `git rev-parse --show-toplevel`, so the projection registers this
// same script under Codex without a rewrite.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKTREE_SEGMENT = `${path.sep}.claude${path.sep}worktrees${path.sep}`
const GUARDED_ROOTS = new Set(['apps', 'packages'])

/**
 * @param {{ filePath?: string, cwd?: string, projectDir?: string, isAgent?: boolean }} input
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide({ filePath, cwd, projectDir, isAgent }) {
  if (!isAgent) return { block: false } // human workflow — never guarded
  if (!filePath) return { block: false }

  const base = cwd || process.cwd()
  const abs = path.resolve(base, filePath)

  // A file already inside a worktree is isolated by definition.
  if (abs.includes(WORKTREE_SEGMENT)) return { block: false }

  const root = projectDir || base
  const rel = path.relative(root, abs)
  // Outside the project tree entirely — not ours to guard.
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { block: false }

  const top = rel.split(path.sep)[0]
  if (!GUARDED_ROOTS.has(top)) return { block: false }

  return {
    block: true,
    reason:
      `Implementation edits must run in a git worktree, not the shared main checkout. ` +
      `"${rel}" is under ${top}/ and the current directory is not below .claude/worktrees/. ` +
      `Enter a worktree first (Claude Code: the EnterWorktree tool; other harnesses: ` +
      `git worktree add .claude/worktrees/<name>) and edit on a ticket branch there. ` +
      `Doc, memory, and config edits in the main checkout are fine — this only guards ` +
      `apps/ and packages/. See AGENTS.md "Session isolation" and docs/agents/worktrees.md.`,
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

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  let payload = {}
  try {
    payload = JSON.parse((await readStdin()) || '{}')
  } catch {
    // Malformed payload — fail open, never wedge the session.
  }

  const cwd = payload.cwd || process.cwd()
  // Claude sends tool_input.file_path; Codex sends toolInput.file_path (camelCase).
  const filePath = payload.tool_input?.file_path ?? payload.toolInput?.file_path
  const decision = decide({
    filePath,
    cwd,
    projectDir: resolveProjectDir(cwd),
    isAgent: Boolean(process.env.CLAUDECODE || process.env.ARGO_HOOK_AGENT),
  })

  if (decision.block) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: decision.reason,
        },
      }),
    )
  }
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
